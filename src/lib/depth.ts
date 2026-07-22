/**
 * Depth levels made intuitive. Each subtopic in the curriculum is tagged
 * with how *deeply* a student is expected to learn it — not everything needs
 * to be mastered to the same degree. We present this as a 1–4 scale with
 * plain-language labels and a one-line meaning, plus a legend on the page so
 * the tags ("fluency", etc.) are never shown without explanation.
 */

export type DepthKey = "awareness" | "procedural" | "fluency" | "proof";

export interface DepthMeta {
  level: 1 | 2 | 3 | 4;
  /** Plain-language label shown next to the meter. */
  label: string;
  /** One-line explanation for the legend and tooltips. */
  meaning: string;
  /** A concrete example phrased for a student. */
  example: string;
  /** Fill color for the meter bars at this level. */
  bar: string;
}

export const DEPTH: Record<DepthKey, DepthMeta> = {
  awareness: {
    level: 1,
    label: "Know it",
    meaning: "Recognize the idea and know that it exists.",
    example: "You could explain roughly what it is.",
    bar: "bg-sky-400",
  },
  procedural: {
    level: 2,
    label: "Apply it",
    meaning: "Solve standard problems by following the method.",
    example: "You can work through textbook exercises on it.",
    bar: "bg-indigo-400",
  },
  fluency: {
    level: 3,
    label: "Master it",
    meaning: "Combine it fluently with other tools in multi-step problems.",
    example: "You can use it inside a harder problem without hints.",
    bar: "bg-violet-500",
  },
  proof: {
    level: 4,
    label: "Prove it",
    meaning: "State it precisely and be able to derive or prove it.",
    example: "You could prove why it works, not just use it.",
    bar: "bg-fuchsia-600",
  },
};

export const DEPTH_ORDER: DepthKey[] = [
  "awareness",
  "procedural",
  "fluency",
  "proof",
];

export function depthOf(key: string): DepthMeta {
  return DEPTH[(key as DepthKey) in DEPTH ? (key as DepthKey) : "awareness"];
}
