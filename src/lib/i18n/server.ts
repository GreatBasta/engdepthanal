import "server-only";

import { eq } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { cache } from "react";

import { currentStudentId } from "@/auth";
import { db } from "@/lib/db/client";
import { students } from "@/lib/db/schema";

import {
  defaultLocale,
  localeFromAcceptLanguage,
  localeCookieName,
  localeSchema,
  type AppLocale,
} from "./config";
import { messagesByLocale, translate, type TranslationKey } from "./messages";

export const getCurrentLocale = cache(async (): Promise<AppLocale> => {
  const studentId = await currentStudentId();
  if (studentId) {
    const [student] = await db
      .select({ preferredLocale: students.preferredLocale })
      .from(students)
      .where(eq(students.id, studentId))
      .limit(1);
    const saved = localeSchema.safeParse(student?.preferredLocale);
    if (saved.success) return saved.data;
  }

  const cookieStore = await cookies();
  const cookieLocale = localeSchema.safeParse(
    cookieStore.get(localeCookieName)?.value,
  );
  if (cookieLocale.success) return cookieLocale.data;

  const requestHeaders = await headers();
  return (
    localeFromAcceptLanguage(requestHeaders.get("accept-language")) ??
    defaultLocale
  );
});

export const getI18n = cache(async () => {
  const locale = await getCurrentLocale();
  const messages = messagesByLocale[locale];
  return {
    locale,
    messages,
    t: (key: TranslationKey, values?: Record<string, string | number>) =>
      translate(messages, key, values),
    formatDate: (
      value: Date | string,
      options: Intl.DateTimeFormatOptions = { dateStyle: "medium" },
    ) => new Intl.DateTimeFormat(locale, options).format(new Date(value)),
    formatNumber: (value: number, options?: Intl.NumberFormatOptions) =>
      new Intl.NumberFormat(locale, options).format(value),
  };
});
