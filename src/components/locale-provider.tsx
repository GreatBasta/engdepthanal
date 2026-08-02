"use client";

import { createContext, useContext, useMemo } from "react";

import type { AppLocale } from "@/lib/i18n/config";
import {
  translate,
  type Messages,
  type TranslationKey,
} from "@/lib/i18n/messages";

interface LocaleContextValue {
  locale: AppLocale;
  messages: Messages;
  t: (key: TranslationKey, values?: Record<string, string | number>) => string;
  formatDate: (
    value: Date | string,
    options?: Intl.DateTimeFormatOptions,
  ) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({
  children,
  locale,
  messages,
}: {
  children: React.ReactNode;
  locale: AppLocale;
  messages: Messages;
}) {
  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      messages,
      t: (key, values) => translate(messages, key, values),
      formatDate: (date, options = { dateStyle: "medium" }) =>
        new Intl.DateTimeFormat(locale, options).format(new Date(date)),
      formatNumber: (number, options) =>
        new Intl.NumberFormat(locale, options).format(number),
    }),
    [locale, messages],
  );
  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(LocaleContext);
  if (!context) throw new Error("useI18n must be used inside LocaleProvider");
  return context;
}
