import { DEPTH, DEPTH_ORDER, depthOf } from "@/lib/depth";

/**
 * A compact 1–4 depth meter with a plain-language label. More filled bars =
 * you need to learn it more deeply. Always paired with <DepthLegend /> on the
 * page so the label is self-explanatory.
 */
export function DepthMeter({ depthKey }: { depthKey: string }) {
  const meta = depthOf(depthKey);
  return (
    <span
      className="inline-flex items-center gap-1.5"
      title={`Depth ${meta.level}/4 — ${meta.label}: ${meta.meaning}`}
    >
      <span className="flex items-end gap-0.5" aria-hidden>
        {[1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={`w-1 rounded-full ${
              i <= meta.level ? meta.bar : "bg-zinc-200 dark:bg-zinc-700"
            }`}
            style={{ height: `${4 + i * 2}px` }}
          />
        ))}
      </span>
      <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
        {meta.label}
      </span>
    </span>
  );
}

/** The key explaining what the depth meters mean, shown once per page. */
export function DepthLegend() {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-sm font-semibold">
        How deeply should you learn each item?
      </p>
      <p className="mt-0.5 text-xs text-zinc-500">
        Not everything needs the same effort. The bars next to each subtopic
        show the target depth — from just knowing it, to being able to prove
        it.
      </p>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {DEPTH_ORDER.map((key) => {
          const meta = DEPTH[key];
          return (
            <li key={key} className="flex items-start gap-2.5">
              <span className="mt-0.5 flex items-end gap-0.5" aria-hidden>
                {[1, 2, 3, 4].map((i) => (
                  <span
                    key={i}
                    className={`w-1 rounded-full ${
                      i <= meta.level
                        ? meta.bar
                        : "bg-zinc-200 dark:bg-zinc-700"
                    }`}
                    style={{ height: `${4 + i * 2}px` }}
                  />
                ))}
              </span>
              <span className="text-xs">
                <span className="font-semibold">{meta.label}</span>
                <span className="text-zinc-500"> — {meta.meaning}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
