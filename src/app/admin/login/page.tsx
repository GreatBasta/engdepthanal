import { redirect } from "next/navigation";

import { adminLoginEnabled, currentAdmin } from "@/lib/admin";
import { AdminLoginForm } from "./ui";

/**
 * Dedicated admin login (username + password from env). Public page — it's a
 * login form; the /admin pages behind it require a valid session.
 */
export default async function AdminLoginPage() {
  if (await currentAdmin()) redirect("/admin");
  const enabled = adminLoginEnabled();

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6 py-16">
      <div className="mb-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-cyan-700 dark:text-cyan-400">
          engdepthanal
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Admin sign-in</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Access the review &amp; verification console.
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        {enabled ? (
          <AdminLoginForm />
        ) : (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Admin login isn&apos;t configured yet. Set{" "}
            <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
              ADMIN_USERNAME
            </code>{" "}
            and{" "}
            <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
              ADMIN_PASSWORD
            </code>{" "}
            in the environment, then reload.
          </p>
        )}
      </div>
    </main>
  );
}
