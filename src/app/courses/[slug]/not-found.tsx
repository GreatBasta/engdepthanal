import Link from "next/link";

export default function CourseNotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-6 text-center">
      <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
        Course unavailable
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">
        This course does not exist or is private.
      </h1>
      <p className="mt-3 text-zinc-600 dark:text-zinc-400">
        Private course details are only visible to their members.
      </p>
      <Link
        href="/courses"
        className="mt-6 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-500"
      >
        Browse public courses
      </Link>
    </main>
  );
}

