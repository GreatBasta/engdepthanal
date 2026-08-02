export default function CourseLoading() {
  return (
    <main className="min-h-screen animate-pulse pb-24 motion-reduce:animate-none">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
          <div className="h-5 w-32 rounded bg-slate-200" />
          <div className="mt-7 h-4 w-full max-w-80 rounded bg-slate-200" />
          <div className="mt-3 h-10 w-full max-w-xl rounded bg-slate-200" />
          <div className="mt-4 h-5 w-full max-w-md rounded bg-slate-200" />
        </div>
        <div className="mx-auto flex max-w-6xl gap-2 overflow-hidden px-4 sm:px-6">
          {[0, 1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-11 w-24 shrink-0 rounded-t bg-slate-100"
            />
          ))}
        </div>
      </div>
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-8 sm:px-6">
        <div className="h-28 rounded-2xl bg-slate-200" />
        {[0, 1, 2].map((item) => (
          <div key={item} className="h-24 rounded-2xl bg-slate-200" />
        ))}
      </div>
    </main>
  );
}
