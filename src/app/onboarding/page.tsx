import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { Suspense } from "react";

import { currentStudentId } from "@/auth";
import { LanguageSelector } from "@/components/language-selector";
import { db } from "@/lib/db/client";
import { enrollments } from "@/lib/db/schema";
import { getI18n } from "@/lib/i18n/server";
import { getTaxonomyOnboardingOptions } from "@/lib/onboarding/programmes";
import { OnboardingForm } from "./ui";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("onboarding.title") };
}

export default async function OnboardingPage() {
  const studentId = await currentStudentId();
  if (!studentId) redirect("/login");

  // Already onboarded → straight to the dashboard.
  const [existing] = await db
    .select({ id: enrollments.id })
    .from(enrollments)
    .where(eq(enrollments.studentId, studentId))
    .limit(1);
  if (existing) redirect("/");

  const { t, locale } = await getI18n();

  return (
    <main className="mx-auto max-w-lg px-6 py-16">
      <div className="mb-6 flex justify-end">
        <Suspense fallback={null}>
          <LanguageSelector />
        </Suspense>
      </div>
      <h1 className="mb-1 text-2xl font-bold">{t("onboarding.title")}</h1>
      <p className="mb-8 text-sm text-zinc-600 dark:text-zinc-400">
        {t("onboarding.subtitle")}
      </p>
      <OnboardingForm
        taxonomyOptions={getTaxonomyOnboardingOptions(locale)}
        defaultLocale={locale}
      />
    </main>
  );
}
