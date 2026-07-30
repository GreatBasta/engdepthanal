import type { Page } from "@playwright/test";

export async function grantPreviewAccess(page: Page) {
  const shareUrl = process.env.VERCEL_SHARE_URL;
  if (!shareUrl) return;
  const response = await page.goto(shareUrl, { waitUntil: "domcontentloaded" });
  if (!response?.ok()) {
    throw new Error(`Vercel preview access failed with ${response?.status()}`);
  }
}
