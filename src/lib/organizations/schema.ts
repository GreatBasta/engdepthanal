import { z } from "zod";

export const organizationSearchParamsSchema = z.object({
  q: z.string().trim().min(2).max(120),
  country: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/)
    .optional(),
});

export const organizationResultSchema = z.object({
  localId: z.string().uuid().nullable(),
  rorId: z.string().url().nullable(),
  canonicalName: z.string().min(1).max(300),
  displayName: z.string().min(1).max(300),
  aliases: z.array(z.string().min(1).max(300)).max(100),
  acronyms: z.array(z.string().min(1).max(80)).max(30),
  organizationType: z.string().min(1).max(80),
  city: z.string().max(200).nullable(),
  region: z.string().max(200).nullable(),
  countryCode: z.string().regex(/^[A-Z]{2}$/),
  countryName: z.string().max(200).nullable(),
  domains: z.array(z.string().min(1).max(253)).max(30),
  websiteUrl: z.string().url().nullable(),
  source: z.enum(["local", "ror"]),
  verified: z.boolean(),
  externalUpdatedAt: z.string().date().nullable(),
});

export type OrganizationResult = z.infer<typeof organizationResultSchema>;

export function parseOrganizationSelection(
  value: FormDataEntryValue | string | null,
) {
  if (typeof value !== "string" || !value) return null;
  try {
    const parsed = organizationResultSchema.safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

const rorNameSchema = z.object({
  value: z.string().min(1).max(300),
  types: z.array(z.string().max(60)).max(20),
  lang: z.string().max(20).nullable().optional(),
});

const rorLocationSchema = z.object({
  geonames_details: z.object({
    name: z.string().max(200),
    country_code: z.string().length(2),
    country_name: z.string().max(200),
    country_subdivision_name: z.string().max(200).nullable().optional(),
  }),
});

const rorRecordSchema = z.object({
  id: z.string().url(),
  status: z.string(),
  types: z.array(z.string()).max(30),
  names: z.array(rorNameSchema).min(1).max(200),
  locations: z.array(rorLocationSchema).max(30),
  domains: z.array(z.string().min(1).max(253)).max(30),
  links: z
    .array(
      z.object({
        type: z.string(),
        value: z.string().url(),
      }),
    )
    .max(50),
  admin: z.object({
    last_modified: z.object({ date: z.string().date() }),
  }),
});

export const rorSearchResponseSchema = z.object({
  items: z.array(rorRecordSchema).max(20),
});

type RorRecord = z.infer<typeof rorRecordSchema>;

function namesWithType(record: RorRecord, type: string) {
  return record.names
    .filter((name) => name.types.includes(type))
    .map((name) => name.value);
}

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function normalizeRorRecord(
  record: RorRecord,
  country?: string,
): OrganizationResult | null {
  if (record.status !== "active" || !record.types.includes("education")) {
    return null;
  }
  const location = record.locations[0]?.geonames_details;
  const countryCode = location?.country_code.toUpperCase();
  if (!countryCode || (country && countryCode !== country)) return null;

  const displays = namesWithType(record, "ror_display");
  const labels = namesWithType(record, "label");
  const canonicalName = displays[0] ?? labels[0] ?? record.names[0].value;
  const displayName = displays[0] ?? canonicalName;
  const website = record.links.find((link) => link.type === "website")?.value;
  const organizationType = record.types.includes("education")
    ? "education"
    : record.types[0] ?? "other";

  return organizationResultSchema.parse({
    localId: null,
    rorId: record.id,
    canonicalName,
    displayName,
    aliases: unique([
      ...namesWithType(record, "alias"),
      ...labels.filter((name) => name !== canonicalName),
    ]),
    acronyms: unique(namesWithType(record, "acronym")),
    organizationType,
    city: location?.name ?? null,
    region: location?.country_subdivision_name ?? null,
    countryCode,
    countryName: location?.country_name ?? null,
    domains: unique(record.domains.map((domain) => domain.toLowerCase())),
    websiteUrl: website ?? null,
    source: "ror",
    verified: true,
    externalUpdatedAt: record.admin.last_modified.date,
  });
}

export function normalizeRorResponse(
  value: unknown,
  country?: string,
): OrganizationResult[] {
  const parsed = rorSearchResponseSchema.safeParse(value);
  if (!parsed.success) return [];
  return parsed.data.items
    .map((record) => normalizeRorRecord(record, country))
    .filter((record): record is OrganizationResult => record !== null);
}

export function normalizeOrganizationName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function dedupeOrganizationResults(
  results: OrganizationResult[],
  limit = 10,
) {
  const rorIds = new Set<string>();
  const domains = new Set<string>();
  const output: OrganizationResult[] = [];
  for (const result of results) {
    if (result.rorId && rorIds.has(result.rorId)) continue;
    const sharedDomain = result.domains.find((domain) => domains.has(domain));
    if (sharedDomain) continue;
    output.push(result);
    if (result.rorId) rorIds.add(result.rorId);
    for (const domain of result.domains) domains.add(domain);
    if (output.length >= limit) break;
  }
  return output;
}
