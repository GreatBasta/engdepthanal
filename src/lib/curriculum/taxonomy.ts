export const curriculumCategoryKeys = [
  "health-medicine",
  "life-sciences",
  "mathematics",
  "physics",
  "chemistry-materials",
  "computing",
  "engineering-core",
  "biomedical",
  "architecture-design",
  "agriculture-veterinary",
  "business-economics",
  "law",
  "social-sciences",
  "psychology",
  "education",
  "humanities",
  "languages-literature",
  "arts-music",
  "communication-media",
  "interdisciplinary",
] as const;

export type CurriculumCategoryKey = (typeof curriculumCategoryKeys)[number];

export const curriculumCategories: ReadonlyArray<{
  key: CurriculumCategoryKey;
  label: string;
  description: string;
}> = [
  {
    key: "health-medicine",
    label: "Health and Medicine",
    description: "Foundational, clinical, population-health, nursing, dental, and pharmaceutical subjects.",
  },
  {
    key: "life-sciences",
    label: "Life Sciences",
    description: "Biology from cells and molecules to organisms, evolution, ecology, and biotechnology.",
  },
  {
    key: "mathematics",
    label: "Mathematics",
    description: "Mathematical foundations, modelling, probability, and computation.",
  },
  {
    key: "physics",
    label: "Physics",
    description: "Mechanics, fields, waves, thermodynamics, and modern physics.",
  },
  {
    key: "chemistry-materials",
    label: "Chemistry & materials",
    description: "Chemistry, materials science, manufacturing, and biomolecular foundations.",
  },
  {
    key: "computing",
    label: "Computing",
    description: "Programming, computer systems, data, algorithms, and software engineering.",
  },
  {
    key: "engineering-core",
    label: "Engineering core",
    description: "Shared analytical, design, systems, and professional engineering subjects.",
  },
  {
    key: "biomedical",
    label: "Biomedical engineering",
    description: "Biological systems, medical technology, biomaterials, and biomechanics.",
  },
  {
    key: "architecture-design",
    label: "Architecture and Design",
    description: "Built environment, spatial thinking, design methods, representation, and material culture.",
  },
  {
    key: "agriculture-veterinary",
    label: "Agriculture and Veterinary Sciences",
    description: "Plant, animal, food, soil, agricultural systems, and veterinary subjects.",
  },
  {
    key: "business-economics",
    label: "Business and Economics",
    description: "Economic reasoning, organizations, accounting, finance, management, and markets.",
  },
  {
    key: "law",
    label: "Law",
    description: "Legal systems, public and private law, legal reasoning, institutions, and rights.",
  },
  {
    key: "social-sciences",
    label: "Social Sciences",
    description: "Politics, society, culture, institutions, international relations, and social research.",
  },
  {
    key: "psychology",
    label: "Psychology",
    description: "Behaviour, cognition, development, social processes, and clinical foundations.",
  },
  {
    key: "education",
    label: "Education",
    description: "Learning, teaching, pedagogy, development, curriculum, and educational institutions.",
  },
  {
    key: "humanities",
    label: "Humanities",
    description: "History, philosophy, ethics, ideas, sources, interpretation, and cultural inquiry.",
  },
  {
    key: "languages-literature",
    label: "Languages and Literature",
    description: "Language systems, literary traditions, textual analysis, theory, and translation.",
  },
  {
    key: "arts-music",
    label: "Arts and Music",
    description: "Visual, performing, and musical practices, analysis, history, and production.",
  },
  {
    key: "communication-media",
    label: "Communication and Media",
    description: "Communication theory, media systems, journalism, audiences, and digital culture.",
  },
  {
    key: "interdisciplinary",
    label: "Interdisciplinary Studies",
    description: "Subjects that deliberately integrate methods and concepts across academic domains.",
  },
];

export const curriculumCategoryByKey = new Map(
  curriculumCategories.map((category) => [category.key, category]),
);
