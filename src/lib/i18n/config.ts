import { z } from "zod";

export const supportedLocales = ["en", "it"] as const;
export const localeSchema = z.enum(supportedLocales);
export type AppLocale = z.infer<typeof localeSchema>;

export const defaultLocale: AppLocale = "en";
export const localeCookieName = "engdepth-locale";

export function localeFromAcceptLanguage(
  value: string | null,
): AppLocale | null {
  if (!value) return null;
  const requested = value
    .split(",")
    .map((part) => part.trim().split(";")[0]?.toLowerCase())
    .filter(Boolean);
  for (const language of requested) {
    const parsed = localeSchema.safeParse(language?.split("-")[0]);
    if (parsed.success) return parsed.data;
  }
  return null;
}
