import { redirect } from "next/navigation";
import { Suspense } from "react";
import type { Metadata } from "next";

import { currentStudentId } from "@/auth";
import { LanguageSelector } from "@/components/language-selector";
import { getI18n } from "@/lib/i18n/server";
import { AuthForms } from "./ui";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("auth.title") };
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const [studentId, i18n] = await Promise.all([currentStudentId(), getI18n()]);
  const { t } = i18n;
  if (studentId) redirect("/");
  const { next } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <div className="mb-6 text-center">
        <div className="mb-5 flex justify-end">
          <Suspense fallback={null}>
            <LanguageSelector />
          </Suspense>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">{t("app.name")}</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {t("auth.subtitle")}
        </p>
      </div>
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <AuthForms next={next ?? "/"} />
      </div>
      <p className="mt-6 text-center text-xs text-zinc-500">
        {t("auth.privacy")}
      </p>
    </main>
  );
}
