import { load } from "cheerio";

import {
  normalizedCatalogResultSchema,
  type ExtractedEvidence,
  type OfficialCatalogConnector,
  type SourceEvidence,
} from "../types";
import { normalizeCatalogText, normalizeCourseCandidate } from "../normalize";

const FIELD_ALIASES: Record<string, string[]> = {
  courseCode: ["course code", "code", "codice", "codice insegnamento", "module code"],
  credits: ["credits", "crediti", "cfu", "ects", "credit points"],
  language: ["language", "lingua", "teaching language", "lingua di erogazione"],
  department: ["department", "dipartimento", "school", "faculty", "facoltà"],
  degreeProgramme: ["degree programme", "study programme", "programme", "corso di laurea", "programma"],
  academicYear: ["academic year", "anno accademico", "year"],
  semester: ["semester", "semestre", "term", "period"],
  professorName: ["instructor", "teacher", "professor", "docente", "lecturer"],
  campus: ["campus", "location", "sede"],
};

function canonicalField(label: string) {
  const normalized = normalizeCatalogText(label).toLocaleLowerCase("en").replace(/:$/, "");
  return Object.entries(FIELD_ALIASES).find(([, aliases]) =>
    aliases.includes(normalized),
  )?.[0];
}

function explicitFields(source: SourceEvidence) {
  const $ = load(source.body);
  $("script, style, noscript, nav, footer").remove();
  const values = new Map<string, { value: string; selector: string }>();
  $("dl").each((dlIndex, dl) => {
    $(dl)
      .find("dt")
      .each((index, term) => {
        const field = canonicalField($(term).text());
        const value = normalizeCatalogText($(term).next("dd").text());
        if (field && value && !values.has(field)) {
          values.set(field, { value, selector: `dl:nth-of-type(${dlIndex + 1}) dt:nth-of-type(${index + 1}) + dd` });
        }
      });
  });
  $("table tr").each((index, row) => {
    const cells = $(row).find("th, td");
    if (cells.length < 2) return;
    const field = canonicalField($(cells[0]).text());
    const value = normalizeCatalogText($(cells[1]).text());
    if (field && value && !values.has(field)) {
      values.set(field, { value, selector: `table tr:nth-of-type(${index + 1})` });
    }
  });
  $("[itemprop]").each((_index, element) => {
    const property = $(element).attr("itemprop");
    const mapped =
      property === "courseCode"
        ? "courseCode"
        : property === "numberOfCredits"
          ? "credits"
          : property === "availableLanguage"
            ? "language"
            : property === "instructor"
              ? "professorName"
              : property === "location"
                ? "campus"
                : null;
    const value = normalizeCatalogText(
      $(element).attr("content") ?? $(element).text(),
    );
    if (mapped && value && !values.has(mapped)) {
      values.set(mapped, { value, selector: `[itemprop='${property}']` });
    }
  });
  const main = $("main").first().length ? $("main").first() : $("body");
  const title = normalizeCatalogText(main.find("h1").first().text());
  const description = normalizeCatalogText(
    main.find("[itemprop='description'], .course-description, .module-description, h1 + p").first().text(),
  );
  return { $, values, title, description };
}

function numericCredits(value: string | undefined) {
  if (!value) return null;
  const match = value.replace(",", ".").match(/\d+(?:\.\d+)?/);
  const parsed = match ? Number(match[0]) : Number.NaN;
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 500 ? parsed : null;
}

export function parseOfficialHtmlCourse(source: SourceEvidence) {
  const { values, title, description } = explicitFields(source);
  if (!title) return [];
  const code = values.get("courseCode")?.value ?? null;
  const credits = numericCredits(values.get("credits")?.value);
  const programme = values.get("degreeProgramme")?.value ?? null;
  const academicYear = values.get("academicYear")?.value ?? null;
  const explicitSignalCount = [code, credits, programme, academicYear].filter(
    (value) => value !== null,
  ).length;
  if (explicitSignalCount < 1) return [];

  const evidence: ExtractedEvidence[] = [
    { field: "name", value: title, sourceUrl: source.sourceUrl, signal: "visible heading", selector: "main h1" },
    ...[...values.entries()].map(([field, item]) => ({
      field,
      value: item.value,
      sourceUrl: source.sourceUrl,
      signal: "explicitly labelled HTML",
      selector: item.selector,
    })),
  ];
  if (description) {
    evidence.push({
      field: "description",
      value: description.slice(0, 1_000),
      sourceUrl: source.sourceUrl,
      signal: "visible description",
      selector: "main description",
    });
  }

  return [
    normalizeCourseCandidate(
      {
        externalSourceId: null,
        courseCode: code,
        canonicalSourceName: title,
        localDisplayName: title,
        description: description || null,
        credits,
        languageCodes: values.get("language")?.value
          ? [values.get("language")!.value]
          : [],
        department: values.get("department")?.value ?? null,
        degreeProgramme: programme,
        programmeExternalSourceId: null,
        academicYear,
        semester: values.get("semester")?.value ?? null,
        professorName: values.get("professorName")?.value ?? null,
        campus: values.get("campus")?.value ?? null,
        officialUrl: source.sourceUrl,
        sourceUpdatedAt: null,
        evidence,
      },
      source,
      {
        officialDomain: true,
        sourceType: "official_catalog",
        currentAcademicYear: null,
      },
    ),
  ];
}

export const htmlCatalogConnector: OfficialCatalogConnector = {
  id: "semantic-html-catalog-v1",
  async canHandle(_context, source) {
    return source?.sourceType === "official_catalog";
  },
  async discoverCatalogSources(context) {
    return context.officialWebsiteUrl
      ? [
          {
            url: context.officialWebsiteUrl,
            sourceType: "official_catalog" as const,
            connectorId: "semantic-html-catalog-v1",
            discoveredFrom: null,
            config: {},
          },
        ]
      : [];
  },
  async discoverOrganizationalUnits() {
    return [];
  },
  async discoverProgrammes() {
    return [];
  },
  async discoverCourses(_context, _programmes, evidence) {
    return parseOfficialHtmlCourse(evidence);
  },
  async normalize(evidence) {
    const courses = parseOfficialHtmlCourse(evidence);
    return normalizedCatalogResultSchema.parse({
      courses,
      warnings: courses.length
        ? []
        : ["No course with explicitly labelled visible metadata was accepted."],
    });
  },
};
