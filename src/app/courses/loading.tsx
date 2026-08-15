export default function CoursesLoading() {
  return (
    <main className="mx-auto min-h-screen max-w-6xl animate-pulse px-4 py-8 motion-reduce:animate-none sm:px-6">
      <div className="h-10 w-72 rounded bg-slate-200" />
      <div className="mt-8 h-44 rounded-2xl bg-slate-200" />
      <div className="mt-7 space-y-5">
        {[0, 1].map((group) => (
          <div key={group} className="h-64 rounded-2xl bg-slate-200" />
        ))}
      </div>
    </main>
  );
}
