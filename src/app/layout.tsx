import type { Metadata } from "next";
import { AppNav } from "@/components/app-nav";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "https://engdepthanal-coral.vercel.app",
  ),
  title: {
    default: "Course Atlas",
    template: "%s · Course Atlas",
  },
  description:
    "Find real university courses, compare curriculum, track private progress, and share contextual study resources.",
  openGraph: {
    title: "Course Atlas",
    description:
      "Collaborative, student-contributed course pages for engineering education.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-950 antialiased">
        <AppNav />
        <div className="pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
          {children}
        </div>
      </body>
    </html>
  );
}
