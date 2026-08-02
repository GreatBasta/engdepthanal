import type { Metadata, Viewport } from "next";
import { AppNav } from "@/components/app-nav";
import { LocaleProvider } from "@/components/locale-provider";
import { getI18n } from "@/lib/i18n/server";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  interactiveWidget: "resizes-content",
};

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return {
    metadataBase: new URL(
      process.env.NEXT_PUBLIC_APP_URL ??
        "https://engdepthanal-coral.vercel.app",
    ),
    title: { default: t("app.name"), template: `%s · ${t("app.name")}` },
    description: t("metadata.description"),
    openGraph: {
      title: t("app.name"),
      description: t("metadata.ogDescription"),
      type: "website",
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { locale, messages } = await getI18n();
  return (
    <html lang={locale}>
      <body className="min-h-screen bg-slate-50 text-slate-950 antialiased">
        <LocaleProvider locale={locale} messages={messages}>
          <AppNav />
          <div className="pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
            {children}
          </div>
        </LocaleProvider>
      </body>
    </html>
  );
}
