export default function HomeLoading() {
  return (
    <main className="mx-auto min-h-screen max-w-6xl animate-pulse px-4 py-8 motion-reduce:animate-none sm:px-6">
      <div className="h-56 rounded-3xl bg-slate-200" />
      <div className="mt-8 h-8 w-52 rounded bg-slate-200" />
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="h-40 rounded-2xl bg-slate-200" />
        ))}
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="h-64 rounded-2xl bg-slate-200" />
        <div className="h-64 rounded-2xl bg-slate-200" />
      </div>
    </main>
  );
}
