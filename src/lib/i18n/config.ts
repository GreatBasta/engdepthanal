import { z } from "zod";

export const supportedLocales = ["en", "it"] as const;
export const localeSchema = z.enum(supportedLocales);
export type AppLocale = z.infer<typeof localeSchema>;

export const defaultLocale: AppLocale = "en";
export const localeCookieName = "engdepth-locale";
