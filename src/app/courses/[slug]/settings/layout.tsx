import Link from "next/link";

export default async function CourseSettingsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const items = [
    ["", "General"],
    ["/members", "Members"],
    ["/curriculum", "Curriculum"],
    ["/privacy", "Privacy"],
  ];
  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-8 sm:px-6">
      <Link href={`/courses/${slug}`} className="text-sm font-semibold text-indigo-700">
        ← Back to course
      </Link>
      <h1 className="mt-5 text-3xl font-black">Course settings</h1>
      <nav aria-label="Course settings" className="mt-5 flex gap-1 overflow-x-auto border-b border-slate-200">
        {items.map(([suffix, label]) => (
          <Link
            key={suffix}
            href={`/courses/${slug}/settings${suffix}`}
            className="min-h-11 shrink-0 px-3 py-3 text-sm font-semibold text-slate-600 hover:text-indigo-700"
          >
            {label}
          </Link>
        ))}
      </nav>
      <div className="py-6">{children}</div>
    </main>
  );
}
