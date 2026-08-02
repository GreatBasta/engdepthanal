import Link from "next/link";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";

import { currentStudentId, signOut } from "@/auth";
import { OrganizationCombobox } from "@/components/organization-combobox";
import { db } from "@/lib/db/client";
import { programs, students } from "@/lib/db/schema";
import {
  getPrimaryEnrollmentForStudent,
  organizationResultFromPrimaryEnrollment,
} from "@/lib/enrollment";

import {
  deleteAccountAction,
  updateProfileAction,
  updateStudyContextAction,
} from "./actions";

export const metadata = { title: "Profile" };

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{
    saved?: string;
    studySaved?: string;
    error?: string;
  }>;
}) {
  const [studentId, query] = await Promise.all([
    currentStudentId(),
    searchParams,
  ]);
  if (!studentId) redirect("/login?next=/profile");
  const [[student], primaryEnrollment, degreePrograms] = await Promise.all([
    db
      .select({
        displayName: students.displayName,
        email: students.email,
        preferredLocale: students.preferredLocale,
      })
      .from(students)
      .where(eq(students.id, studentId))
      .limit(1),
    getPrimaryEnrollmentForStudent(studentId),
    db
      .select({ slug: programs.slug, name: programs.name })
      .from(programs)
      .where(eq(programs.status, "verified"))
      .orderBy(asc(programs.name)),
  ]);
  if (!student) redirect("/login");
  const defaultOrganization = primaryEnrollment
    ? organizationResultFromPrimaryEnrollment(primaryEnrollment)
    : null;

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="text-3xl font-black">Profile</h1>
      <p className="mt-2 text-slate-600">
        Manage your public name and your account data.
      </p>
      {query.saved ? (
        <p role="status" className="mt-5 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
          Profile saved.
        </p>
      ) : null}
      {query.studySaved ? (
        <p role="status" className="mt-5 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
          Study context saved. Discover and recommendations now use this university.
        </p>
      ) : null}
      {query.error ? (
        <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-800">
          The requested account change could not be completed. Check the form and try again.
        </p>
      ) : null}

      <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="font-bold">Profile details</h2>
        <form action={updateProfileAction} className="mt-5 space-y-4">
          <label className="block text-sm font-semibold">
            Display name
            <input
              name="displayName"
              required
              minLength={2}
              maxLength={80}
              defaultValue={student.displayName}
              className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3"
            />
          </label>
          <label className="block text-sm font-semibold">
            Email
            <input
              value={student.email}
              disabled
              className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 text-slate-500"
            />
          </label>
          <button className="min-h-11 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white">
            Save profile
          </button>
        </form>
      </section>

      <section id="study-context" className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="font-bold">Study context</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          This university controls default discovery and recommendations. Changing it does
          not remove previous memberships, owned courses, contributions, resources, exams,
          or private progress.
        </p>
        {primaryEnrollment && defaultOrganization ? (
          <form action={updateStudyContextAction} className="mt-5 space-y-4">
            <OrganizationCombobox
              defaultOrganization={defaultOrganization}
              countryCode={undefined}
              label="Primary university"
            />
            <label className="block text-sm font-semibold">
              Degree program
              <select
                name="programSlug"
                defaultValue={primaryEnrollment.programSlug}
                required
                className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3"
              >
                {degreePrograms.map((program) => (
                  <option key={program.slug} value={program.slug}>
                    {program.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-semibold">
              Intake year
              <input
                name="intakeYear"
                type="number"
                min={2000}
                max={2100}
                required
                defaultValue={primaryEnrollment.intakeYear}
                className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3"
              />
            </label>
            <label className="block text-sm font-semibold">
              Preferred language
              <select
                name="preferredLocale"
                defaultValue={student.preferredLocale === "it" ? "it" : "en"}
                className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3"
              >
                <option value="en">English</option>
                <option value="it">Italiano</option>
              </select>
            </label>
            <button className="min-h-11 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white">
              Save study context
            </button>
          </form>
        ) : (
          <Link
            href="/onboarding"
            className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white"
          >
            Choose university
          </Link>
        )}
      </section>

      <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="font-bold">Your data</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/api/account/export"
            className="inline-flex min-h-11 items-center rounded-xl border border-slate-300 px-4 text-sm font-semibold"
          >
            Export my data
          </Link>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
          >
            <button className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold">
              Sign out
            </button>
          </form>
        </div>
      </section>

      <details className="mt-5 rounded-2xl border border-red-200 bg-white p-5">
        <summary className="cursor-pointer font-bold text-red-700">Delete account</summary>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Your login and personal profile will be anonymized. Shared contributions remain
          attributed to “Deleted student” so course history is preserved.
        </p>
        <form action={deleteAccountAction} className="mt-4">
          <label className="block text-sm font-semibold">
            Type DELETE to confirm
            <input
              name="confirmation"
              className="mt-1 min-h-11 w-full rounded-xl border border-red-300 px-3"
            />
          </label>
          <button className="mt-3 min-h-11 rounded-xl bg-red-700 px-4 text-sm font-semibold text-white">
            Delete my account
          </button>
        </form>
      </details>
    </main>
  );
}
