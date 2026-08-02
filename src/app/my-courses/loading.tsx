export default function MyCoursesLoading() {
  return (
    <main className="mx-auto min-h-screen max-w-6xl animate-pulse px-4 py-8 motion-reduce:animate-none sm:px-6">
      <div className="h-10 w-56 rounded bg-slate-200" />
      <div className="mt-8 h-7 w-80 rounded bg-slate-200" />
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="h-44 rounded-2xl bg-slate-200" />
        ))}
      </div>
    </main>
  );
}
