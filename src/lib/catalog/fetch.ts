import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import type { LookupFunction } from "node:net";

import type { CatalogLimits, SourceEvidence } from "./types";
import {
  allowedCatalogContentType,
  assertAllowedRedirect,
  assertSafeResolvedAddresses,
  assertTrustedCatalogUrl,
  evaluateRobotsTxt,
} from "./policy";

export interface SafeCatalogRequestOptions {
  approvedDomains: string[];
  userAgent: string;
  limits: CatalogLimits;
  etag?: string | null;
  lastModified?: string | null;
  purpose?: "catalog" | "robots";
  redirectsRemaining?: number;
}

interface RawResponse {
  url: URL;
  status: number;
  headers: Record<string, string>;
  body: string;
}

export function assertCatalogResponseSize(
  receivedBytes: number,
  declaredBytes: number | null,
  maximumBytes: number,
) {
  if (
    receivedBytes > maximumBytes ||
    (declaredBytes !== null &&
      Number.isFinite(declaredBytes) &&
      declaredBytes > maximumBytes)
  ) {
    throw new Error("catalog response exceeds the size limit");
  }
}

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value.join(", ") : value;
}

async function requestOnce(
  url: URL,
  options: SafeCatalogRequestOptions,
): Promise<RawResponse> {
  const addresses = await lookup(url.hostname, { all: true, verbatim: true });
  assertSafeResolvedAddresses(addresses.map((result) => result.address));
  const pinned = addresses[0];
  if (!pinned) throw new Error("catalog host did not resolve");

  const pinnedLookup = ((
    _hostname: string,
    _options: unknown,
    callback: (error: Error | null, address?: string, family?: number) => void,
  ) => callback(null, pinned.address, pinned.family)) as LookupFunction;

  return new Promise((resolve, reject) => {
    const request = httpsRequest(
      url,
      {
        method: "GET",
        lookup: pinnedLookup,
        servername: url.hostname,
        headers: {
          "user-agent": options.userAgent,
          accept:
            options.purpose === "robots"
              ? "text/plain;q=1, text/*;q=0.8"
              : "application/ld+json, application/json, application/xml, text/xml, text/html, application/xhtml+xml",
          "accept-encoding": "identity",
          ...(options.etag ? { "if-none-match": options.etag } : {}),
          ...(options.lastModified
            ? { "if-modified-since": options.lastModified }
            : {}),
        },
      },
      (response) => {
        const status = response.statusCode ?? 0;
        const headers = Object.fromEntries(
          Object.entries(response.headers).flatMap(([key, value]) => {
            const normalized = headerValue(value);
            return normalized ? [[key.toLowerCase(), normalized]] : [];
          }),
        );
        const declaredLength = Number(headers["content-length"] ?? 0);
        try {
          assertCatalogResponseSize(
            0,
            Number.isFinite(declaredLength) ? declaredLength : null,
            options.limits.maxResponseBytes,
          );
        } catch (error) {
          response.destroy();
          reject(error);
          return;
        }

        const chunks: Buffer[] = [];
        let received = 0;
        response.on("data", (chunk: Buffer) => {
          received += chunk.byteLength;
          try {
            assertCatalogResponseSize(
              received,
              null,
              options.limits.maxResponseBytes,
            );
          } catch (error) {
            response.destroy(error as Error);
            return;
          }
          chunks.push(Buffer.from(chunk));
        });
        response.on("error", reject);
        response.on("end", () => {
          resolve({
            url,
            status,
            headers,
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
      },
    );
    request.setTimeout(options.limits.timeoutMs, () => {
      request.destroy(new Error("catalog request timed out"));
    });
    request.on("error", reject);
    request.end();
  });
}

export async function safeCatalogRequest(
  input: string | URL,
  options: SafeCatalogRequestOptions,
): Promise<RawResponse> {
  const url = assertTrustedCatalogUrl(input, options.approvedDomains);
  const response = await requestOnce(url, options);
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.location;
    const redirectsRemaining = options.redirectsRemaining ?? 3;
    if (!location) throw new Error("catalog redirect has no location");
    if (redirectsRemaining <= 0) throw new Error("catalog redirect limit exceeded");
    const redirected = assertAllowedRedirect(url, location, options.approvedDomains);
    return safeCatalogRequest(redirected, {
      ...options,
      etag: null,
      lastModified: null,
      redirectsRemaining: redirectsRemaining - 1,
    });
  }
  if (response.status === 304) return response;
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`catalog request returned HTTP ${response.status}`);
  }
  const contentType = response.headers["content-type"];
  if (
    options.purpose !== "robots" &&
    !allowedCatalogContentType(contentType)
  ) {
    throw new Error("catalog response content type is not allowed");
  }
  return response;
}

export async function fetchSourceEvidence(
  url: string,
  sourceType: SourceEvidence["sourceType"],
  options: SafeCatalogRequestOptions,
): Promise<SourceEvidence | { notModified: true; url: string }> {
  const response = await safeCatalogRequest(url, options);
  if (response.status === 304) return { notModified: true, url: response.url.href };
  return {
    sourceUrl: response.url.href,
    sourceType,
    fetchedAt: new Date().toISOString(),
    status: response.status,
    contentType: response.headers["content-type"] ?? "application/octet-stream",
    etag: response.headers.etag ?? null,
    lastModified: response.headers["last-modified"] ?? null,
    checksum: createHash("sha256").update(response.body).digest("hex"),
    body: response.body,
  };
}

export async function checkRobotsPermission(
  targetUrl: string,
  options: SafeCatalogRequestOptions,
): Promise<{
  status: "allowed" | "disallowed" | "unavailable" | "error";
  allowed: boolean;
  crawlDelayMs: number;
  matchedRule: string | null;
}> {
  const target = assertTrustedCatalogUrl(targetUrl, options.approvedDomains);
  const robotsUrl = new URL("/robots.txt", target);
  try {
    const response = await safeCatalogRequest(robotsUrl, {
      ...options,
      purpose: "robots",
      etag: null,
      lastModified: null,
    });
    const evaluation = evaluateRobotsTxt(
      response.body,
      target,
      options.userAgent.split("/", 1)[0],
    );
    return {
      status: evaluation.allowed ? "allowed" : "disallowed",
      allowed: evaluation.allowed,
      crawlDelayMs: Math.max(
        options.limits.minDelayMs,
        Math.min((evaluation.crawlDelaySeconds ?? 0) * 1_000, 30_000),
      ),
      matchedRule: evaluation.matchedRule,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "robots failure";
    if (message.includes("HTTP 404") || message.includes("HTTP 410")) {
      return {
        status: "unavailable",
        allowed: true,
        crawlDelayMs: options.limits.minDelayMs,
        matchedRule: null,
      };
    }
    return {
      status: "error",
      allowed: false,
      crawlDelayMs: options.limits.minDelayMs,
      matchedRule: null,
    };
  }
}
