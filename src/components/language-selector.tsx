"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useRef } from "react";

import { setLocaleAction } from "@/app/locale-actions";
import { useI18n } from "@/components/locale-provider";

export function LanguageSelector({ compact = false }: { compact?: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const formRef = useRef<HTMLFormElement>(null);
  const { locale, t } = useI18n();
  const query = searchParams.toString();
  const returnTo = `${pathname}${query ? `?${query}` : ""}`;

  return (
    <form ref={formRef} action={setLocaleAction} className="shrink-0">
      <input type="hidden" name="returnTo" value={returnTo} />
      <label className={compact ? "sr-only" : "text-xs font-semibold"}>
        {t("language.label")}
        <select
          name="locale"
          value={locale}
          aria-label={t("language.label")}
          onChange={() => formRef.current?.requestSubmit()}
          className={
            compact
              ? "min-h-11 rounded-lg border-0 bg-transparent px-1 text-xs font-bold uppercase text-slate-600"
              : "ml-2 min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm"
          }
        >
          <option value="en">EN</option>
          <option value="it">IT</option>
        </select>
      </label>
    </form>
  );
}
