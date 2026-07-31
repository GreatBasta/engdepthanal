export const curriculumCategoryKeys = [
  "mathematics",
  "physics",
  "chemistry-materials",
  "computing",
  "engineering-core",
  "biomedical",
] as const;

export type CurriculumCategoryKey = (typeof curriculumCategoryKeys)[number];

export const curriculumCategories: ReadonlyArray<{
  key: CurriculumCategoryKey;
  label: string;
  description: string;
}> = [
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
];

export const curriculumCategoryByKey = new Map(
  curriculumCategories.map((category) => [category.key, category]),
);
