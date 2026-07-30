import { expect, test } from "@playwright/test";

test("home is usable without horizontal overflow", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Find your actual course/i }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Find your course" })).toBeVisible();

  const widths = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(widths.content).toBeLessThanOrEqual(widths.viewport);
});

test("mobile navigation has four labelled one-handed targets", async ({
  page,
}, testInfo) => {
  test.skip(
    !["iphone-se", "iphone-modern", "pixel-7"].includes(testInfo.project.name),
    "Mobile-only bottom navigation check",
  );
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Primary navigation" });
  await expect(nav).toBeVisible();

  for (const label of ["Home", "My courses", "Discover", "Profile"]) {
    const target = nav.getByRole("link", { name: label });
    await expect(target).toBeVisible();
    const box = await target.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  }
});

test("legal and removal routes are public", async ({ page }) => {
  for (const route of [
    "/privacy",
    "/terms",
    "/community-guidelines",
    "/copyright",
    "/contact",
  ]) {
    const response = await page.goto(route);
    expect(response?.status()).toBe(200);
    await expect(page.locator("h1")).toBeVisible();
  }
});

test("dedicated admin login is unavailable", async ({ page }) => {
  await page.goto("/admin/login");
  await expect(page).toHaveURL(/\/login\?next=(%2F|\/)admin/);
  await expect(page.getByRole("heading", { name: "Course Atlas" })).toBeVisible();
});
