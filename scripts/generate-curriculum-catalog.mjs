import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { buildMultidisciplinaryTemplates } from "./multidisciplinary-templates.mjs";

const ACCESSED_AT = "2026-08-03";
const GENERATED_AT = "2026-08-03T00:00:00.000Z";

const sources = {
  mathematics: [
    {
      title: "MIT OpenCourseWare mathematics courses",
      organization: "Massachusetts Institute of Technology",
      url: "https://ocw.mit.edu/search/?d=Mathematics",
      accessedAt: ACCESSED_AT,
      note: "Topic coverage was synthesized and paraphrased from public course outlines.",
    },
    {
      title: "OpenStax Math",
      organization: "OpenStax, Rice University",
      url: "https://openstax.org/subjects/math",
      accessedAt: ACCESSED_AT,
    },
  ],
  physics: [
    {
      title: "MIT OpenCourseWare physics courses",
      organization: "Massachusetts Institute of Technology",
      url: "https://ocw.mit.edu/search/?d=Physics",
      accessedAt: ACCESSED_AT,
    },
    {
      title: "OpenStax University Physics",
      organization: "OpenStax, Rice University",
      url: "https://openstax.org/details/books/university-physics-volume-1",
      accessedAt: ACCESSED_AT,
    },
  ],
  "chemistry-materials": [
    {
      title: "OpenStax Chemistry 2e",
      organization: "OpenStax, Rice University",
      url: "https://openstax.org/details/books/chemistry-2e",
      accessedAt: ACCESSED_AT,
    },
    {
      title: "Criteria for Accrediting Engineering Programs, 2025–2026",
      organization: "ABET",
      url: "https://www.abet.org/accreditation/accreditation-criteria/criteria-for-accrediting-engineering-programs-2025-2026/",
      accessedAt: ACCESSED_AT,
    },
  ],
  computing: [
    {
      title: "Computing Curricula 2020",
      organization: "ACM and IEEE Computer Society",
      url: "https://www.acm.org/education/curricula-recommendations",
      accessedAt: ACCESSED_AT,
    },
    {
      title: "Computer Science Curricula 2023",
      organization: "ACM, IEEE Computer Society, and AAAI",
      url: "https://csed.acm.org/",
      accessedAt: ACCESSED_AT,
    },
  ],
  "engineering-core": [
    {
      title: "Criteria for Accrediting Engineering Programs, 2025–2026",
      organization: "ABET",
      url: "https://www.abet.org/accreditation/accreditation-criteria/criteria-for-accrediting-engineering-programs-2025-2026/",
      accessedAt: ACCESSED_AT,
    },
    {
      title: "MIT OpenCourseWare engineering courses",
      organization: "Massachusetts Institute of Technology",
      url: "https://ocw.mit.edu/search/?d=Engineering",
      accessedAt: ACCESSED_AT,
    },
  ],
  biomedical: [
    {
      title: "OpenStax Anatomy and Physiology 2e",
      organization: "OpenStax, Rice University",
      url: "https://openstax.org/details/books/anatomy-and-physiology-2e",
      accessedAt: ACCESSED_AT,
    },
    {
      title: "OpenStax Biology 2e",
      organization: "OpenStax, Rice University",
      url: "https://openstax.org/details/books/biology-2e",
      accessedAt: ACCESSED_AT,
    },
    {
      title: "Criteria for Accrediting Engineering Programs, 2025–2026",
      organization: "ABET",
      url: "https://www.abet.org/accreditation/accreditation-criteria/criteria-for-accrediting-engineering-programs-2025-2026/",
      accessedAt: ACCESSED_AT,
    },
  ],
};

const slugify = (value) =>
  value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const outlines = [
  ["calculus-2", "Calculus II", "mathematics", ["all-engineering"], 1, 2, ["Techniques of integration", "Improper integrals", "Sequences and series", "Power series", "Parametric curves", "Polar coordinates"]],
  ["multivariable-calculus", "Multivariable Calculus", "mathematics", ["all-engineering"], 2, 1, ["Vectors and geometry", "Partial derivatives", "Multiple integrals", "Vector fields", "Line and surface integrals", "Integral theorems"]],
  ["ordinary-differential-equations", "Ordinary Differential Equations", "mathematics", ["all-engineering"], 2, 1, ["First-order equations", "Linear higher-order equations", "Systems of ODEs", "Laplace transforms", "Series solutions", "Qualitative and numerical methods"]],
  ["probability-statistics", "Probability and Statistics", "mathematics", ["all-engineering", "data-science"], 2, 1, ["Probability foundations", "Random variables", "Common distributions", "Sampling and estimation", "Hypothesis testing", "Regression and experimental design"]],
  ["discrete-mathematics", "Discrete Mathematics", "mathematics", ["computer-engineering", "computer-science"], 1, 2, ["Logic and proof", "Sets and relations", "Counting", "Graphs and trees", "Recurrences", "Discrete probability"]],
  ["numerical-methods", "Numerical Methods", "mathematics", ["all-engineering", "scientific-computing"], 2, 2, ["Floating-point computation", "Root finding", "Linear systems", "Interpolation and approximation", "Numerical differentiation and integration", "Numerical ODEs"]],
  ["complex-transform-methods", "Complex Numbers and Transform Methods", "mathematics", ["electrical-engineering", "physics"], 2, 2, ["Complex algebra and geometry", "Analytic functions", "Contour integration", "Fourier series", "Fourier transform", "Laplace and z transforms"]],
  ["optimization-fundamentals", "Optimization Fundamentals", "mathematics", ["all-engineering", "data-science"], 2, 2, ["Model formulation", "Unconstrained optimization", "Constrained optimization", "Linear programming", "Convexity and duality", "Numerical optimization"]],

  ["electricity-magnetism", "Electricity and Magnetism", "physics", ["all-engineering", "electrical-engineering"], 1, 2, ["Electric charge and field", "Electric potential", "Capacitance and dielectrics", "Magnetic fields", "Electromagnetic induction", "Maxwell equations and waves"]],
  ["waves-optics", "Waves and Optics", "physics", ["all-engineering"], 2, 1, ["Oscillations", "Mechanical waves", "Sound", "Geometric optics", "Interference and diffraction", "Polarization and optical systems"]],
  ["thermodynamics-physics", "Thermodynamics", "physics", ["all-engineering"], 1, 2, ["Temperature and equilibrium", "Heat and work", "First law", "Second law and entropy", "Thermodynamic potentials", "Kinetic theory"]],
  ["modern-physics", "Modern Physics Fundamentals", "physics", ["all-engineering"], 2, 2, ["Special relativity", "Photons and matter waves", "Quantum states", "Atomic structure", "Nuclear physics", "Solid-state foundations"]],

  ["organic-biochemistry-engineers", "Organic and Biochemistry for Engineers", "chemistry-materials", ["chemical-engineering", "biomedical-engineering"], 2, 1, ["Organic structure and bonding", "Functional groups", "Reaction mechanisms", "Biomolecules", "Enzymes and metabolism", "Biochemical analysis"]],
  ["materials-science", "Materials Science and Engineering", "chemistry-materials", ["all-engineering", "materials-engineering"], 2, 1, ["Atomic bonding", "Crystal structure", "Defects and diffusion", "Mechanical behavior", "Phase diagrams", "Materials selection"]],
  ["materials-manufacturing", "Engineering Materials and Manufacturing Processes", "chemistry-materials", ["mechanical-engineering", "industrial-engineering"], 2, 2, ["Metals and heat treatment", "Polymers and composites", "Ceramics and glasses", "Casting and forming", "Machining and joining", "Additive and sustainable manufacturing"]],

  ["programming-fundamentals", "Programming Fundamentals", "computing", ["all-engineering"], 1, 1, ["Computational thinking", "Variables and control flow", "Functions and decomposition", "Collections and strings", "Files and errors", "Testing and debugging"]],
  ["object-oriented-programming", "Object-Oriented Programming", "computing", ["computer-engineering", "computer-science"], 1, 2, ["Objects and classes", "Encapsulation", "Inheritance and polymorphism", "Interfaces and composition", "Exceptions and resources", "Testing object-oriented systems"]],
  ["data-structures-algorithms", "Data Structures and Algorithms", "computing", ["computer-engineering", "computer-science"], 2, 1, ["Complexity analysis", "Linear structures", "Trees and heaps", "Hashing", "Graph algorithms", "Algorithm design paradigms"]],
  ["computer-architecture-digital-logic", "Computer Architecture and Digital Logic", "computing", ["computer-engineering", "electrical-engineering"], 2, 1, ["Boolean logic", "Combinational circuits", "Sequential circuits", "Instruction-set architecture", "Processor datapaths", "Memory and I/O"]],
  ["database-fundamentals", "Database Fundamentals", "computing", ["computer-science", "data-science"], 2, 1, ["Data modeling", "Relational algebra", "SQL", "Normalization", "Transactions and concurrency", "Indexes and query processing"]],
  ["data-science-fundamentals", "Data Science Fundamentals", "computing", ["all-engineering", "data-science"], 2, 2, ["Data acquisition and ethics", "Data cleaning", "Exploratory analysis", "Statistical modeling", "Machine-learning workflow", "Communication and reproducibility"]],
  ["scientific-computing", "Scientific Computing", "computing", ["all-engineering"], 2, 2, ["Reproducible computation", "Array and matrix computing", "Numerical stability", "Simulation", "Data visualization", "Performance and validation"]],
  ["web-software-engineering", "Web and Software Engineering Fundamentals", "computing", ["computer-science"], 2, 2, ["Requirements and design", "Version control", "Web foundations", "APIs and data flow", "Testing and delivery", "Security and maintainability"]],

  ["engineering-drawing-cad", "Engineering Drawing and CAD", "engineering-core", ["all-engineering"], 1, 1, ["Visualization and sketching", "Orthographic projection", "Dimensioning and tolerancing", "Section and assembly drawings", "Parametric CAD", "Technical drawing standards"]],
  ["statics", "Statics", "engineering-core", ["mechanical-engineering", "civil-engineering"], 1, 2, ["Force systems", "Equilibrium", "Structures and trusses", "Internal forces", "Friction", "Centroids and moments of inertia"]],
  ["dynamics", "Dynamics", "engineering-core", ["mechanical-engineering", "civil-engineering"], 2, 1, ["Particle kinematics", "Particle kinetics", "Work and energy", "Impulse and momentum", "Rigid-body kinematics", "Rigid-body dynamics"]],
  ["mechanics-materials", "Mechanics of Materials", "engineering-core", ["mechanical-engineering", "civil-engineering"], 2, 1, ["Stress and strain", "Axial loading", "Torsion", "Beam bending", "Combined loading", "Deflection and buckling"]],
  ["circuit-analysis", "Circuit Analysis", "engineering-core", ["electrical-engineering", "biomedical-engineering"], 1, 2, ["Circuit variables and laws", "Node and mesh methods", "Network theorems", "First-order circuits", "Sinusoidal steady state", "Power and frequency response"]],
  ["electronics", "Electronics", "engineering-core", ["electrical-engineering", "biomedical-engineering"], 2, 1, ["Semiconductor fundamentals", "Diodes", "Transistors", "Amplifiers", "Operational amplifiers", "Digital and power electronics"]],
  ["signals-systems", "Signals and Systems", "engineering-core", ["electrical-engineering", "biomedical-engineering"], 2, 1, ["Signal classification", "Linear time-invariant systems", "Convolution", "Fourier analysis", "Laplace and z analysis", "Sampling and reconstruction"]],
  ["control-systems", "Control Systems", "engineering-core", ["mechanical-engineering", "electrical-engineering", "biomedical-engineering"], 2, 2, ["Dynamic modeling", "Transfer functions", "Time response", "Stability", "Frequency response", "Feedback design"]],
  ["engineering-thermodynamics", "Engineering Thermodynamics", "engineering-core", ["mechanical-engineering", "chemical-engineering"], 2, 1, ["Properties and state models", "Energy balances", "Entropy balances", "Power and refrigeration cycles", "Mixtures and psychrometrics", "Exergy and efficiency"]],
  ["fluid-mechanics", "Fluid Mechanics", "engineering-core", ["mechanical-engineering", "civil-engineering", "biomedical-engineering"], 2, 1, ["Fluid properties", "Hydrostatics", "Control-volume analysis", "Differential flow analysis", "Dimensional analysis", "Internal and external flows"]],
  ["measurement-instrumentation", "Measurement and Instrumentation", "engineering-core", ["all-engineering"], 2, 1, ["Measurement systems", "Sensors and transducers", "Signal conditioning", "Uncertainty and calibration", "Data acquisition", "Experimental design"]],
  ["engineering-design", "Engineering Design", "engineering-core", ["all-engineering"], 2, 2, ["Problem framing", "Stakeholders and requirements", "Concept generation", "Modeling and prototyping", "Trade-off decisions", "Verification and lifecycle"]],
  ["engineering-project-management", "Engineering Project Management", "engineering-core", ["all-engineering"], 3, 1, ["Project definition", "Scheduling", "Cost and resources", "Risk and quality", "Teams and communication", "Agile and stage-gate delivery"]],
  ["technical-communication", "Technical Communication", "engineering-core", ["all-engineering"], 1, 2, ["Audience and purpose", "Technical reports", "Figures and data", "Presentations", "Collaboration and review", "Ethics and citation"]],

  ["biology-engineers", "Biology for Engineers", "biomedical", ["biomedical-engineering", "chemical-engineering"], 1, 1, ["Cell structure and function", "Genetics and information", "Energy and metabolism", "Transport and signaling", "Tissues and homeostasis", "Evolution and biological design"]],
  ["anatomy-physiology", "Anatomy and Physiology", "biomedical", ["biomedical-engineering"], 1, 2, ["Anatomical organization", "Musculoskeletal system", "Nervous system", "Cardiovascular and respiratory systems", "Renal and digestive systems", "Endocrine and reproductive systems"]],
  ["biomedical-signals", "Biomedical Signals", "biomedical", ["biomedical-engineering"], 3, 1, ["Bioelectric origins", "ECG and cardiac signals", "EEG and neural signals", "EMG and movement signals", "Filtering and feature extraction", "Clinical interpretation and validation"]],
  ["medical-imaging", "Medical Imaging", "biomedical", ["biomedical-engineering"], 3, 1, ["Imaging physics", "X-ray and CT", "MRI", "Ultrasound", "Nuclear medicine", "Image quality and reconstruction"]],
  ["biomaterials", "Biomaterials", "biomedical", ["biomedical-engineering", "materials-engineering"], 3, 1, ["Host-material interactions", "Metals and ceramics", "Polymers and hydrogels", "Surface engineering", "Degradation and drug delivery", "Testing and regulation"]],
  ["biomechanics", "Biomechanics", "biomedical", ["biomedical-engineering", "mechanical-engineering"], 3, 1, ["Biomechanical statics", "Kinematics and kinetics", "Tissue mechanics", "Musculoskeletal mechanics", "Cardiovascular mechanics", "Model validation and movement analysis"]],
];

const legacyTemplates = [
  ["calculus-1.json", "calculus-1", "Calculus I", "mathematics", ["all-engineering"], 1, 1],
  ["linear-algebra.json", "linear-algebra", "Linear Algebra", "mathematics", ["all-engineering"], 1, 2],
  ["physics-1.json", "classical-mechanics", "Classical Mechanics", "physics", ["all-engineering"], 1, 1],
  ["chemistry-1.json", "general-chemistry-engineers", "General Chemistry for Engineers", "chemistry-materials", ["all-engineering", "chemical-engineering"], 1, 1],
];

function convertLegacy([file, templateKey, name, category, degreePrograms, year, semester]) {
  const legacy = JSON.parse(
    readFileSync(resolve(process.cwd(), "curriculum", file), "utf8"),
  );
  const subtopicId = new Map();
  for (const topic of legacy.topics) {
    for (const subtopic of topic.subtopics) {
      subtopicId.set(subtopic.slug, `${templateKey}.subtopic.${subtopic.slug}`);
    }
  }
  return {
    templateKey,
    name,
    description: legacy.subject.description,
    category,
    disciplineTags: Array.from(new Set([...degreePrograms, category])),
    recommendedDegreePrograms: degreePrograms,
    typicalYear: year,
    typicalSemester: semester,
    version: 1,
    sourceReferences: sources[category],
    topics: legacy.topics.map((topic, topicIndex) => ({
      stableId: `${templateKey}.topic.${topic.slug}`,
      slug: topic.slug,
      name: topic.name,
      description: topic.description || `Core university coverage for ${topic.name}.`,
      position: topicIndex + 1,
      subtopics: topic.subtopics.map((subtopic, subtopicIndex) => ({
        stableId: subtopicId.get(subtopic.slug),
        slug: subtopic.slug,
        name: subtopic.name,
        description:
          subtopic.description || `Foundational study of ${subtopic.name}.`,
        depthLevel: subtopic.depth,
        estimatedHours: subtopic.est_hours ?? 1,
        prerequisiteStableIds: (subtopic.prerequisites ?? []).map(
          (slug) => subtopicId.get(slug),
        ),
        optional: false,
        position: subtopicIndex + 1,
      })),
    })),
  };
}

function outlineTemplate([templateKey, name, category, degreePrograms, year, semester, topicNames]) {
  let previousStableId = null;
  return {
    templateKey,
    name,
    description: `A reusable, source-informed university curriculum foundation for ${name}, designed for local course-page customization.`,
    category,
    disciplineTags: Array.from(new Set([...degreePrograms, category])),
    recommendedDegreePrograms: degreePrograms,
    typicalYear: year,
    typicalSemester: semester,
    version: 1,
    sourceReferences: sources[category],
    topics: topicNames.map((topicName, topicIndex) => {
      const topicSlug = slugify(topicName);
      const topicStableId = `${templateKey}.topic.${topicSlug}`;
      const subtopicNames = [
        `${topicName}: concepts and terminology`,
        `${topicName}: analytical and computational methods`,
        `${topicName}: engineering applications and interpretation`,
      ];
      const subtopics = subtopicNames.map((subtopicName, subtopicIndex) => {
        const stableId = `${templateKey}.subtopic.${topicSlug}-${subtopicIndex + 1}`;
        const prerequisiteStableIds =
          subtopicIndex === 0 && previousStableId ? [previousStableId] : [];
        previousStableId = stableId;
        return {
          stableId,
          slug: `${topicSlug}-${subtopicIndex + 1}`,
          name: subtopicName,
          description:
            subtopicIndex === 0
              ? `Define, recognize, and explain the principal ideas in ${topicName}.`
              : subtopicIndex === 1
                ? `Select and apply standard methods for problems involving ${topicName}.`
                : `Connect ${topicName} to realistic engineering models, evidence, assumptions, and limitations.`,
          depthLevel: subtopicIndex === 0 ? "procedural" : "fluency",
          estimatedHours: subtopicIndex === 1 ? 3 : 2,
          prerequisiteStableIds,
          optional: false,
          position: subtopicIndex + 1,
        };
      });
      return {
        stableId: topicStableId,
        slug: topicSlug,
        name: topicName,
        description: `Core concepts, methods, and engineering interpretation for ${topicName}.`,
        position: topicIndex + 1,
        subtopics,
      };
    }),
  };
}

const domainByCategory = {
  "health-medicine": "health-medicine",
  "life-sciences": "life-sciences",
  mathematics: "mathematics-statistics",
  physics: "physical-sciences",
  "chemistry-materials": "physical-sciences",
  computing: "computing-information",
  "engineering-core": "engineering-technology",
  biomedical: "engineering-technology",
  "architecture-design": "architecture-design",
  "agriculture-veterinary": "agriculture-veterinary",
  "business-economics": "business-economics",
  law: "law",
  "social-sciences": "social-sciences",
  psychology: "psychology",
  education: "education",
  humanities: "humanities",
  "languages-literature": "languages-literature",
  "arts-music": "arts-music",
  "communication-media": "communication-media",
  interdisciplinary: "interdisciplinary-studies",
};

function completeMetadata(template) {
  return {
    localizedNames: { en: template.name },
    academicDomainKey: domainByCategory[template.category],
    typicalDegreeLevels: ["bachelor"],
    typicalStage: `typical year ${template.typicalYear}`,
    curricularStatus: "core",
    validationMetadata: {
      reviewedAt: ACCESSED_AT,
      reviewedBy: "Course Atlas curriculum validator",
      contentStandard: template.sourceReferences
        .map((reference) => reference.title)
        .join("; "),
      notes: [
        "Canonical synthesis only; never an official university syllabus.",
      ],
    },
    ...template,
  };
}

const templates = [
  ...legacyTemplates.map(convertLegacy),
  ...outlines.map(outlineTemplate),
  ...buildMultidisciplinaryTemplates(slugify),
]
  .map(completeMetadata)
  .sort((a, b) => a.templateKey.localeCompare(b.templateKey));

writeFileSync(
  resolve(process.cwd(), "curriculum", "catalog.json"),
  `${JSON.stringify({ schemaVersion: 1, generatedAt: GENERATED_AT, templates }, null, 2)}\n`,
);

console.log(
  `Generated ${templates.length} templates, ${templates.reduce((n, template) => n + template.topics.length, 0)} topics, ` +
    `${templates.reduce((n, template) => n + template.topics.reduce((m, topic) => m + topic.subtopics.length, 0), 0)} subtopics`,
);
