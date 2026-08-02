"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

import { LanguageSelector } from "@/components/language-selector";
import { useI18n } from "@/components/locale-provider";

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/courses") {
    return pathname === "/courses" || pathname.startsWith("/courses/");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppNav() {
  const pathname = usePathname();
  const { t } = useI18n();
  if (pathname === "/login" || pathname === "/onboarding") return null;
  const items = [
    { href: "/", label: t("nav.home"), glyph: "⌂" },
    { href: "/my-courses", label: t("nav.myCourses"), glyph: "▤" },
    { href: "/courses", label: t("nav.discover"), glyph: "⌕" },
    { href: "/profile", label: t("nav.profile"), glyph: "○" },
  ] as const;

  return (
    <>
      <header className="sticky top-0 z-40 hidden border-b border-slate-200/80 bg-white/90 backdrop-blur md:block">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link href="/" className="text-lg font-black tracking-tight">
            {t("app.name")}
          </Link>
          <div className="flex items-center gap-2">
            <nav
              aria-label={t("nav.primary")}
              className="flex items-center gap-1"
            >
              {items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={
                    isActive(pathname, item.href) ? "page" : undefined
                  }
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                    isActive(pathname, item.href)
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <Suspense fallback={null}>
              <LanguageSelector />
            </Suspense>
          </div>
        </div>
      </header>
      <nav
        aria-label={t("nav.primary")}
        className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <div className="grid h-16 grid-cols-[repeat(4,minmax(0,1fr))_3rem]">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(pathname, item.href) ? "page" : undefined}
              className={`flex min-h-11 flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-semibold ${
                isActive(pathname, item.href)
                  ? "text-indigo-700"
                  : "text-slate-500"
              }`}
            >
              <span aria-hidden className="text-xl leading-none">
                {item.glyph}
              </span>
              <span>{item.label}</span>
            </Link>
          ))}
          <Suspense fallback={null}>
            <div className="flex items-center justify-center">
              <LanguageSelector compact />
            </div>
          </Suspense>
        </div>
      </nav>
    </>
  );
}
