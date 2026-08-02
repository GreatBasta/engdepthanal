import { expect, test } from "@playwright/test";

import { grantPreviewAccess } from "./support";

function organization(displayName: string, rorId: string) {
  return {
    localId: null,
    rorId,
    canonicalName: displayName,
    displayName,
    aliases: [],
    acronyms: [],
    organizationType: "education",
    city: "Milano",
    region: "Lombardia",
    countryCode: "IT",
    countryName: "Italy",
    domains: ["example.edu"],
    websiteUrl: "https://example.edu",
    source: "ror",
    verified: true,
    externalUpdatedAt: "2026-01-01",
  };
}

test.beforeEach(async ({ page }) => {
  await grantPreviewAccess(page);
});

test("stale organization searches cannot replace newer results", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop",
    "Request cancellation runs once",
  );
  await page.route("**/api/organizations/search**", async (route) => {
    const query = new URL(route.request().url()).searchParams.get("q");
    if (query === "po") {
      await new Promise((resolve) => setTimeout(resolve, 700));
      await route.fulfill({
        json: {
          results: [
            organization("Stale Polytechnic", "https://ror.org/000000001"),
          ],
        },
      });
      return;
    }
    await route.fulfill({
      json: {
        results: [
          organization("Current Polytechnic", "https://ror.org/000000002"),
        ],
      },
    });
  });

  await page.goto("/courses?scope=all");
  const search = page.getByRole("combobox", { name: "University" });
  await search.fill("po");
  await page.waitForTimeout(350);
  await search.fill("pol");
  await expect(
    page.getByRole("option", { name: /Current Polytechnic/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("option", { name: /Stale Polytechnic/ }),
  ).toHaveCount(0);
});
