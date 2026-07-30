import { expect, test } from "@playwright/test";

import { grantPreviewAccess } from "./support";

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;
const runId = process.env.E2E_RUN_ID ?? "preview";

test("signup to private course, resource upload, moderation, and denial", async ({
  browser,
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  test.skip(
    testInfo.project.name !== "pixel-7",
    "Authenticated write journey runs once on the Pixel 7 profile",
  );
  test.skip(!email || !password, "Preview credentials are required");
  await grantPreviewAccess(page);
  await page.goto("/login");

  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  const signup = page.locator("form");
  await signup.getByLabel("Your name").fill(`Preview E2E ${runId}`);
  await signup.getByLabel("Email").fill(email!);
  await signup.getByLabel("Password").fill(password!);
  await signup
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await page.waitForURL(/\/onboarding/);

  await page
    .getByRole("combobox", { name: "Your university", exact: true })
    .fill(`Preview E2E University ${runId}`);
  await page.getByLabel("Country").selectOption("IT");
  await page
    .getByLabel("Your course (engineering discipline)")
    .selectOption("computer-engineering");
  await page
    .getByRole("radio", { name: "I'm actively attending" })
    .check();
  await page
    .getByRole("button", { name: "Unlock the first-year database" })
    .click();
  await page.waitForURL(/\/my-courses/);

  await page.goto("/courses/new");
  await page
    .getByLabel("Local course name")
    .fill(`Preview Systems Course ${runId}`);
  await page.getByRole("button", { name: "Continue" }).click();

  const defaultTemplate = page.getByRole("checkbox").first();
  if (await defaultTemplate.isChecked()) await defaultTemplate.uncheck();
  const templateSearch = page.getByLabel("Search templates");
  await templateSearch.fill("Calculus I");
  await page.getByRole("checkbox", { name: /^Calculus Iv1/ }).check();
  await templateSearch.fill("Linear Algebra");
  await page.getByRole("checkbox", { name: /Linear Algebra/ }).check();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("radio", { name: /Private/ }).check();
  await page
    .getByRole("button", { name: "Create course" })
    .click({ noWaitAfter: true });
  await page.waitForURL(/\/courses\/.+\?tab=curriculum/);

  const courseUrl = page.url();
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: `Preview Systems Course ${runId}`,
    }),
  ).toBeVisible();
  await expect(page.getByText("Editable draft").first()).toBeVisible();
  await page.getByRole("button", { name: "Publish draft" }).click();

  const resourcesUrl = new URL(courseUrl);
  resourcesUrl.search = "?tab=resources";
  await page.goto(resourcesUrl.toString());
  const title = `Preview upload ${runId}`;
  const composer = page.getByRole("heading", { name: "Add a resource" }).locator("..");
  await composer.getByLabel("Title").fill(title);
  await composer.getByLabel("Note").fill("Preview-only upload permission test.");
  await composer
    .getByRole("button", { name: "Publish resource" })
    .click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();

  const resource = page
    .getByRole("listitem")
    .filter({ has: page.getByRole("heading", { name: title }) });
  await resource.getByLabel("Attachment file").setInputFiles({
    name: `preview-${runId}.md`,
    mimeType: "text/markdown",
    buffer: Buffer.from("# Preview-only attachment\n"),
  });
  await resource.getByRole("button", { name: "Attach" }).click();
  await expect(resource.getByText("Attachment uploaded.")).toBeVisible();
  await expect(resource.getByRole("link", { name: new RegExp(`preview-${runId}`) })).toBeVisible();

  await resource.getByRole("button", { name: "Hide attachment" }).click();
  await expect(
    resource.getByRole("link", { name: new RegExp(`preview-${runId}`) }),
  ).toHaveCount(0);
  const settingsUrl = new URL(courseUrl);
  settingsUrl.search = "";
  settingsUrl.pathname = `${settingsUrl.pathname}/settings`;
  await page.goto(settingsUrl.toString());
  await expect(page.getByRole("heading", { name: "Hidden attachments" })).toBeVisible();
  await page.getByRole("button", { name: "Restore" }).click();
  await expect(page.getByRole("heading", { name: "Hidden attachments" })).toHaveCount(0);

  await page.goto(resourcesUrl.toString());
  const restoredResource = page
    .getByRole("listitem")
    .filter({ has: page.getByRole("heading", { name: title }) });
  await restoredResource
    .getByRole("button", { name: "Hide attachment" })
    .click();
  await page.goto(settingsUrl.toString());
  await page
    .getByText("Delete permanently", { exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm permanent deletion" })
    .click();
  await expect(page.getByRole("heading", { name: "Hidden attachments" })).toHaveCount(0);

  const exportResponse = await page.request.get(
    new URL("/api/account/export", courseUrl).toString(),
  );
  expect(exportResponse.status()).toBe(200);
  expect(await exportResponse.json()).toMatchObject({
    profile: { email },
  });

  const anonymousContext = await browser.newContext();
  const anonymousPage = await anonymousContext.newPage();
  await grantPreviewAccess(anonymousPage);
  const denied = await anonymousPage.goto(courseUrl);
  expect(denied?.status()).toBe(404);
  await anonymousContext.close();
});
