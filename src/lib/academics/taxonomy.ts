import { z } from "zod";

export const academicFieldLevels = [
  "domain",
  "broad_field",
  "discipline",
  "subdiscipline",
  "professional_area",
] as const;

export const degreeLevels = [
  "bachelor",
  "master",
  "single_cycle",
  "doctoral",
  "professional",
  "other",
] as const;

export const academicTaxonomyEntrySchema = z.object({
  key: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  parentKey: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).nullable(),
  level: z.enum(academicFieldLevels),
  labels: z.object({ en: z.string().min(1), it: z.string().min(1) }).catchall(z.string()),
  aliases: z
    .object({ en: z.array(z.string()), it: z.array(z.string()) })
    .catchall(z.array(z.string())),
  typicalDegreeLevels: z.array(z.enum(degreeLevels)),
  classificationReferences: z.array(
    z.object({ scheme: z.string(), code: z.string().optional(), url: z.string().url().optional() }),
  ),
});

export type AcademicTaxonomyEntry = z.infer<typeof academicTaxonomyEntrySchema>;
export type DegreeLevel = (typeof degreeLevels)[number];

const ISCED_URL = "https://uis.unesco.org/en/topic/international-standard-classification-education-isced";
const levels: DegreeLevel[] = ["bachelor", "master", "doctoral"];
const professionalLevels: DegreeLevel[] = [
  "bachelor",
  "master",
  "single_cycle",
  "doctoral",
  "professional",
];

function entry(
  key: string,
  parentKey: string | null,
  level: AcademicTaxonomyEntry["level"],
  en: string,
  it: string,
  aliases: { en?: string[]; it?: string[] } = {},
  typicalDegreeLevels: DegreeLevel[] = levels,
  iscedCode?: string,
): AcademicTaxonomyEntry {
  return {
    key,
    parentKey,
    level,
    labels: { en, it },
    aliases: { en: aliases.en ?? [], it: aliases.it ?? [] },
    typicalDegreeLevels,
    classificationReferences: iscedCode
      ? [{ scheme: "ISCED-F 2013", code: iscedCode, url: ISCED_URL }]
      : [],
  };
}

/**
 * Product taxonomy: multilingual and extensible, conceptually cross-walked to
 * ISCED-F without exposing that external vocabulary as the product model.
 */
export const academicTaxonomy: readonly AcademicTaxonomyEntry[] = [
  entry("health-medicine", null, "domain", "Health and Medicine", "Salute e Medicina", {}, professionalLevels, "09"),
  entry("life-sciences", null, "domain", "Life Sciences", "Scienze della vita", {}, levels, "051"),
  entry("physical-sciences", null, "domain", "Physical Sciences", "Scienze fisiche", {}, levels, "053"),
  entry("mathematics-statistics", null, "domain", "Mathematics and Statistics", "Matematica e Statistica", {}, levels, "054"),
  entry("computing-information", null, "domain", "Computing and Information", "Informatica e Informazione", {}, levels, "061"),
  entry("engineering-technology", null, "domain", "Engineering and Technology", "Ingegneria e Tecnologia", {}, levels, "071"),
  entry("architecture-design", null, "domain", "Architecture and Design", "Architettura e Design", {}, professionalLevels, "073"),
  entry("agriculture-veterinary", null, "domain", "Agriculture and Veterinary Sciences", "Agraria e Scienze veterinarie", {}, professionalLevels, "08"),
  entry("business-economics", null, "domain", "Business and Economics", "Economia e Management", {}, levels, "041"),
  entry("law", null, "domain", "Law", "Giurisprudenza", {}, professionalLevels, "0421"),
  entry("social-sciences", null, "domain", "Social Sciences", "Scienze sociali", {}, levels, "031"),
  entry("psychology", null, "domain", "Psychology", "Psicologia", {}, professionalLevels, "0313"),
  entry("education", null, "domain", "Education", "Scienze dell'educazione", {}, professionalLevels, "011"),
  entry("humanities", null, "domain", "Humanities", "Scienze umanistiche", {}, levels, "022"),
  entry("languages-literature", null, "domain", "Languages and Literature", "Lingue e Letterature", {}, levels, "023"),
  entry("arts-music", null, "domain", "Arts and Music", "Arti e Musica", {}, professionalLevels, "021"),
  entry("communication-media", null, "domain", "Communication and Media", "Comunicazione e Media", {}, levels, "032"),
  entry("interdisciplinary-studies", null, "domain", "Interdisciplinary Studies", "Studi interdisciplinari", {}, levels, "00"),

  entry("medicine", "health-medicine", "discipline", "Medicine", "Medicina", { en: ["Medical sciences"], it: ["Medicina e chirurgia"] }, professionalLevels, "0912"),
  entry("dentistry", "health-medicine", "discipline", "Dentistry", "Odontoiatria", {}, professionalLevels, "0911"),
  entry("nursing", "health-medicine", "discipline", "Nursing", "Infermieristica", {}, professionalLevels, "0913"),
  entry("pharmacy", "health-medicine", "discipline", "Pharmacy", "Farmacia", {}, professionalLevels, "0916"),
  entry("public-health", "health-medicine", "discipline", "Public Health", "Sanità pubblica", { en: ["Population health"], it: ["Salute pubblica"] }, professionalLevels, "0919"),
  entry("biomedical-sciences", "health-medicine", "discipline", "Biomedical Sciences", "Scienze biomediche", {}, levels, "0914"),

  entry("biology", "life-sciences", "discipline", "Biology", "Biologia", { en: ["Biological sciences"], it: ["Scienze biologiche"] }, levels, "0511"),
  entry("biotechnology", "life-sciences", "discipline", "Biotechnology", "Biotecnologie", {}, levels, "0512"),
  entry("neuroscience", "life-sciences", "subdiscipline", "Neuroscience", "Neuroscienze", {}, levels),
  entry("bioinformatics", "life-sciences", "subdiscipline", "Bioinformatics", "Bioinformatica", {}, levels),
  entry("ecology", "life-sciences", "subdiscipline", "Ecology", "Ecologia", {}, levels),

  entry("physics", "physical-sciences", "discipline", "Physics", "Fisica", {}, levels, "0533"),
  entry("chemistry", "physical-sciences", "discipline", "Chemistry", "Chimica", {}, levels, "0531"),
  entry("earth-science", "physical-sciences", "discipline", "Earth Science", "Scienze della Terra", { en: ["Geoscience"], it: ["Geoscienze"] }, levels, "0532"),
  entry("environmental-science", "physical-sciences", "discipline", "Environmental Science", "Scienze ambientali", {}, levels, "0521"),

  entry("mathematics", "mathematics-statistics", "discipline", "Mathematics", "Matematica", {}, levels, "0541"),
  entry("statistics", "mathematics-statistics", "discipline", "Statistics", "Statistica", { en: ["Statistical science"], it: ["Scienze statistiche"] }, levels, "0542"),

  entry("computer-science", "computing-information", "discipline", "Computer Science", "Informatica", { en: ["Computing"], it: ["Scienze informatiche"] }, levels, "0613"),
  entry("information-science", "computing-information", "discipline", "Information Science", "Scienze dell'informazione", {}, levels, "0322"),
  entry("data-science", "computing-information", "subdiscipline", "Data Science", "Data Science", { it: ["Scienza dei dati"] }, levels),

  entry("engineering", "engineering-technology", "broad_field", "Engineering", "Ingegneria", {}, levels, "071"),
  entry("biomedical-engineering", "engineering", "discipline", "Biomedical Engineering", "Ingegneria biomedica", {}, levels, "0719"),
  entry("civil-engineering", "engineering", "discipline", "Civil Engineering", "Ingegneria civile", {}, levels, "0732"),
  entry("electrical-engineering", "engineering", "discipline", "Electrical and Electronic Engineering", "Ingegneria elettrica ed elettronica", {}, levels, "0714"),
  entry("mechanical-engineering", "engineering", "discipline", "Mechanical Engineering", "Ingegneria meccanica", {}, levels, "0715"),
  entry("chemical-engineering", "engineering", "discipline", "Chemical Engineering", "Ingegneria chimica", {}, levels, "0711"),

  entry("architecture", "architecture-design", "discipline", "Architecture", "Architettura", {}, professionalLevels, "0731"),
  entry("design", "architecture-design", "discipline", "Design", "Design", { en: ["Product design"], it: ["Disegno industriale"] }, professionalLevels, "0212"),

  entry("agriculture", "agriculture-veterinary", "discipline", "Agriculture", "Scienze agrarie", { en: ["Agricultural sciences"], it: ["Agraria"] }, professionalLevels, "081"),
  entry("veterinary-medicine", "agriculture-veterinary", "discipline", "Veterinary Medicine", "Medicina veterinaria", {}, professionalLevels, "0841"),

  entry("economics", "business-economics", "discipline", "Economics", "Economia", {}, levels, "0311"),
  entry("business-management", "business-economics", "discipline", "Business and Management", "Economia aziendale e Management", {}, levels, "0413"),
  entry("accounting-finance", "business-economics", "discipline", "Accounting and Finance", "Contabilità e Finanza", {}, levels, "0411"),
  entry("legal-studies", "law", "discipline", "Legal Studies", "Scienze giuridiche", {}, professionalLevels, "0421"),

  entry("political-science", "social-sciences", "discipline", "Political Science", "Scienze politiche", {}, levels, "0312"),
  entry("sociology", "social-sciences", "discipline", "Sociology", "Sociologia", {}, levels, "0314"),
  entry("anthropology", "social-sciences", "discipline", "Anthropology", "Antropologia", {}, levels, "0314"),
  entry("geography", "social-sciences", "discipline", "Geography", "Geografia", {}, levels, "0314"),
  entry("psychological-sciences", "psychology", "discipline", "Psychological Sciences", "Scienze psicologiche", {}, professionalLevels, "0313"),

  entry("education-sciences", "education", "discipline", "Education Sciences", "Scienze dell'educazione", {}, professionalLevels, "0111"),
  entry("pedagogy", "education", "subdiscipline", "Pedagogy", "Pedagogia", {}, professionalLevels),

  entry("history", "humanities", "discipline", "History", "Storia", {}, levels, "0222"),
  entry("philosophy", "humanities", "discipline", "Philosophy", "Filosofia", {}, levels, "0223"),
  entry("archaeology", "humanities", "discipline", "Archaeology", "Archeologia", {}, levels, "0222"),

  entry("literature", "languages-literature", "discipline", "Literature", "Letteratura", { en: ["Literary studies"], it: ["Studi letterari"] }, levels, "0232"),
  entry("linguistics", "languages-literature", "discipline", "Linguistics", "Linguistica", {}, levels, "0232"),
  entry("languages", "languages-literature", "discipline", "Languages", "Lingue", { en: ["Modern languages"], it: ["Lingue moderne"] }, levels, "0231"),
  entry("translation-studies", "languages-literature", "subdiscipline", "Translation Studies", "Traduzione e Interpretariato", {}, professionalLevels, "0231"),

  entry("visual-arts", "arts-music", "discipline", "Visual Arts", "Arti visive", {}, professionalLevels, "0213"),
  entry("music", "arts-music", "discipline", "Music", "Musica", {}, professionalLevels, "0215"),
  entry("performing-arts", "arts-music", "discipline", "Performing Arts", "Arti performative", {}, professionalLevels, "0215"),

  entry("communication-studies", "communication-media", "discipline", "Communication Studies", "Scienze della comunicazione", {}, levels, "0321"),
  entry("media-studies", "communication-media", "discipline", "Media Studies", "Studi sui media", {}, levels, "0321"),
  entry("environmental-studies", "interdisciplinary-studies", "discipline", "Environmental Studies", "Studi ambientali", {}, levels),
  entry("cognitive-science", "interdisciplinary-studies", "discipline", "Cognitive Science", "Scienze cognitive", {}, levels),
] as const;

export interface AcademicTaxonomyIssue {
  key: string;
  message: string;
}

export function validateAcademicTaxonomy(
  entries: readonly AcademicTaxonomyEntry[] = academicTaxonomy,
): AcademicTaxonomyIssue[] {
  const issues: AcademicTaxonomyIssue[] = [];
  const keys = new Set<string>();
  for (const rawEntry of entries) {
    const parsed = academicTaxonomyEntrySchema.safeParse(rawEntry);
    if (!parsed.success) {
      issues.push({ key: rawEntry.key, message: parsed.error.issues[0]?.message ?? "invalid entry" });
      continue;
    }
    if (keys.has(rawEntry.key)) issues.push({ key: rawEntry.key, message: "duplicate key" });
    keys.add(rawEntry.key);
  }
  for (const item of entries) {
    if (item.parentKey && !keys.has(item.parentKey)) {
      issues.push({ key: item.key, message: `missing parent ${item.parentKey}` });
    }
    if (item.parentKey === item.key) issues.push({ key: item.key, message: "self parent" });
  }
  return issues;
}

export function searchAcademicTaxonomy(query: string, locale: string = "en") {
  const normalized = query.trim().toLocaleLowerCase(locale);
  if (normalized.length < 2) return [];
  return academicTaxonomy
    .filter((item) => {
      const labels = Object.values(item.labels);
      const aliases = Object.values(item.aliases).flat();
      return [...labels, ...aliases].some((value) =>
        value.toLocaleLowerCase(locale).includes(normalized),
      );
    })
    .slice(0, 12);
}
