import Link from "next/link";

export function LegalPage({
  title,
  intro,
  sections,
}: {
  title: string;
  intro: string;
  sections: Array<{ title: string; body: string }>;
}) {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-10 sm:px-6">
      <p className="text-sm font-semibold text-indigo-700">Course Atlas policies</p>
      <h1 className="mt-2 text-3xl font-black">{title}</h1>
      <p className="mt-4 leading-7 text-slate-600">{intro}</p>
      <div className="mt-8 space-y-7">
        {sections.map((section) => (
          <section key={section.title}>
            <h2 className="text-lg font-bold">{section.title}</h2>
            <p className="mt-2 whitespace-pre-line leading-7 text-slate-700">{section.body}</p>
          </section>
        ))}
      </div>
      <nav aria-label="Policies" className="mt-10 flex flex-wrap gap-x-5 gap-y-3 border-t border-slate-200 pt-6 text-sm font-semibold text-indigo-700">
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
        <Link href="/community-guidelines">Community Guidelines</Link>
        <Link href="/copyright">Copyright &amp; removal</Link>
        <Link href="/contact">Contact</Link>
      </nav>
    </main>
  );
}
