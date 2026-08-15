import { isIP } from "node:net";

const METADATA_HOSTS = new Set([
  "metadata.google.internal",
  "metadata.google.com",
  "instance-data",
  "169.254.169.254",
]);

export function normalizeCatalogDomain(value: string): string {
  const candidate = value.trim().toLowerCase().replace(/^\.+|\.+$/g, "");
  if (!candidate || candidate.includes("/") || candidate.includes("@")) {
    throw new Error("invalid catalog domain");
  }
  return new URL(`https://${candidate}`).hostname;
}

export function hostMatchesApprovedDomain(host: string, domain: string) {
  const normalizedHost = normalizeCatalogDomain(host);
  const normalizedDomain = normalizeCatalogDomain(domain);
  return (
    normalizedHost === normalizedDomain ||
    normalizedHost.endsWith(`.${normalizedDomain}`)
  );
}

export function isPrivateIpAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) {
    const parts = address.split(".").map(Number);
    const [a, b] = parts;
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 0) ||
      (a === 192 && b === 0 && parts[2] === 2) ||
      (a === 192 && b === 88 && parts[2] === 99) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      (a === 198 && b === 51 && parts[2] === 100) ||
      (a === 203 && b === 0 && parts[2] === 113) ||
      a >= 224
    );
  }
  if (family === 6) {
    const normalized = address.toLowerCase();
    if (normalized === "::" || normalized === "::1") return true;
    if (normalized.startsWith("::ffff:")) {
      return isPrivateIpAddress(normalized.slice("::ffff:".length));
    }
    const first = Number.parseInt(normalized.split(":")[0] || "0", 16);
    return (
      (first & 0xfe00) === 0xfc00 ||
      (first & 0xffc0) === 0xfe80 ||
      normalized.startsWith("2001:db8:") ||
      normalized.startsWith("ff")
    );
  }
  return true;
}

export function assertTrustedCatalogUrl(
  input: string | URL,
  approvedDomains: readonly string[],
): URL {
  const url = input instanceof URL ? new URL(input) : new URL(input);
  if (url.protocol !== "https:") throw new Error("catalog URLs must use HTTPS");
  if (url.username || url.password) throw new Error("URL credentials are not allowed");
  if (url.port && url.port !== "443") throw new Error("non-standard ports are not allowed");
  const hostname = url.hostname.toLowerCase();
  if (METADATA_HOSTS.has(hostname) || isIP(hostname)) {
    throw new Error("IP and metadata hosts are not allowed");
  }
  if (!approvedDomains.some((domain) => hostMatchesApprovedDomain(hostname, domain))) {
    throw new Error("URL is outside the approved organization boundary");
  }
  url.hash = "";
  return url;
}

export function assertSafeResolvedAddresses(addresses: readonly string[]) {
  if (!addresses.length) throw new Error("catalog host did not resolve");
  if (addresses.some(isPrivateIpAddress)) {
    throw new Error("catalog host resolves to a private or reserved address");
  }
}

export function assertAllowedRedirect(
  from: URL,
  location: string,
  approvedDomains: readonly string[],
) {
  return assertTrustedCatalogUrl(new URL(location, from), approvedDomains);
}

interface RobotsRule {
  allow: boolean;
  path: string;
}

function robotsPatternMatches(pathname: string, pattern: string): boolean {
  if (!pattern) return false;
  const endAnchored = pattern.endsWith("$");
  const raw = endAnchored ? pattern.slice(0, -1) : pattern;
  const escaped = raw
    .split("*")
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${escaped}${endAnchored ? "$" : ""}`).test(pathname);
}

export function evaluateRobotsTxt(
  robotsText: string,
  target: URL,
  crawlerProduct = "CourseAtlasCatalogBot",
): { allowed: boolean; crawlDelaySeconds: number | null; matchedRule: string | null } {
  const groups: Array<{ agents: string[]; rules: RobotsRule[]; delay: number | null }> = [];
  let current: (typeof groups)[number] | null = null;

  for (const rawLine of robotsText.split(/\r?\n/)) {
    const line = rawLine.replace(/\s*#.*$/, "").trim();
    if (!line) continue;
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (key === "user-agent") {
      if (!current || current.rules.length || current.delay !== null) {
        current = { agents: [], rules: [], delay: null };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
    } else if (current && (key === "allow" || key === "disallow")) {
      if (value) current.rules.push({ allow: key === "allow", path: value });
    } else if (current && key === "crawl-delay") {
      const delay = Number(value);
      if (Number.isFinite(delay) && delay >= 0) current.delay = delay;
    }
  }

  const product = crawlerProduct.toLowerCase();
  const matching = groups.filter((group) =>
    group.agents.some((agent) => agent === "*" || product.includes(agent)),
  );
  const specific = matching.filter((group) => group.agents.some((agent) => agent !== "*"));
  const selected = specific.length ? specific : matching;
  const matches = selected
    .flatMap((group) => group.rules)
    .filter((rule) => robotsPatternMatches(target.pathname || "/", rule.path))
    .sort((left, right) => {
      const length = right.path.replace(/[*$]/g, "").length - left.path.replace(/[*$]/g, "").length;
      return length || Number(right.allow) - Number(left.allow);
    });
  const matched = matches[0] ?? null;
  const crawlDelay = selected
    .map((group) => group.delay)
    .filter((delay): delay is number => delay !== null)
    .sort((left, right) => right - left)[0] ?? null;
  return {
    allowed: matched?.allow ?? true,
    crawlDelaySeconds: crawlDelay,
    matchedRule: matched?.path ?? null,
  };
}

export function allowedCatalogContentType(value: string | undefined) {
  if (!value) return false;
  const mime = value.split(";", 1)[0]?.trim().toLowerCase();
  return new Set([
    "text/html",
    "application/xhtml+xml",
    "application/json",
    "application/ld+json",
    "application/xml",
    "text/xml",
  ]).has(mime ?? "");
}
