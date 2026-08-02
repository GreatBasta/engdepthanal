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
    .fill("Politecnico di Milano");
  await page.getByRole("option").first().click();
  await page
    .getByLabel("Your course (engineering discipline)")
    .selectOption("computer-engineering");
  await page.getByRole("radio", { name: "I'm actively attending" }).check();
  await page
    .getByRole("button", { name: "Unlock the first-year database" })
    .click();
  await page.waitForURL(/\/$/);

  await page.goto("/courses/new");
  const courseName = `Preview Systems Course ${runId}`;
  await page.getByLabel("Local course name").fill(courseName);
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(
    page.getByRole("heading", { name: "Mathematics", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Engineering core", exact: true }),
  ).toBeVisible();
  const defaultTemplate = page.getByRole("checkbox").first();
  if (await defaultTemplate.isChecked()) await defaultTemplate.uncheck();
  const templateSearch = page.getByLabel("Search templates");
  await templateSearch.fill("Calculus I");
  await page.getByRole("checkbox", { name: /^Calculus I/ }).check();
  await templateSearch.fill("Linear Algebra");
  await page.getByRole("checkbox", { name: /Linear Algebra/ }).check();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("radio", { name: /Private/ }).check();
  await page.locator("form").evaluate((form: HTMLFormElement) => {
    form.requestSubmit();
  });
  await page.waitForURL(/\/courses\/.+\/settings\/curriculum/);

  const courseUrl = new URL(page.url());
  courseUrl.pathname = courseUrl.pathname.replace("/settings/curriculum", "");
  courseUrl.search = "";
  await expect(
    page.getByRole("heading", {
      name: "Curriculum setup",
    }),
  ).toBeVisible();
  await expect(page.getByText(/of [1-9]\d* classified/).first()).toBeVisible();
  await expect(page.getByText("Editable draft")).toHaveCount(0);
  const topicButtons = page.locator(
    'button[aria-controls^="curriculum-topic-panel-"]',
  );
  const lowerTopic = topicButtons.last();
  await lowerTopic.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, -80));
  const beforeExpansion = await page.evaluate(() => window.scrollY);
  await lowerTopic.click();
  await expect(lowerTopic).toHaveAttribute("aria-expanded", "true");
  await expect(
    page.getByRole("button", { name: "Covered" }).first(),
  ).toBeVisible();
  const afterExpansion = await page.evaluate(() => window.scrollY);
  expect(afterExpansion).toBeGreaterThan(100);
  expect(Math.abs(afterExpansion - beforeExpansion)).toBeLessThan(180);

  await lowerTopic.click();
  await expect(lowerTopic).toHaveAttribute("aria-expanded", "false");
  const afterCollapse = await page.evaluate(() => window.scrollY);
  expect(afterCollapse).toBeGreaterThan(100);
  expect(Math.abs(afterCollapse - afterExpansion)).toBeLessThan(180);

  await lowerTopic.click();
  await expect(
    page.getByRole("button", { name: "Covered" }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Covered" }).first().click();
  const applyButton = page.getByRole("button", { name: "Apply changes" });
  await expect(applyButton).toBeEnabled();
  const beforeApply = await page.evaluate(() => window.scrollY);
  await applyButton.click();
  await expect(page.getByText("Curriculum changes applied.")).toBeVisible();
  const afterApply = await page.evaluate(() => window.scrollY);
  expect(afterApply).toBeGreaterThan(100);
  expect(Math.abs(afterApply - beforeApply)).toBeLessThan(240);

  const resourcesUrl = new URL(courseUrl);
  resourcesUrl.search = "?tab=resources";
  await page.goto(resourcesUrl.toString());
  const title = `Preview upload ${runId}`;
  const composer = page
    .getByRole("heading", { name: "Add a resource" })
    .locator("..");
  await composer.getByLabel("Title").fill(title);
  await composer
    .getByLabel("Note", { exact: true })
    .fill("Preview-only upload permission test.");
  await composer.getByRole("button", { name: "Publish resource" }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible({
    timeout: 20_000,
  });

  const resource = page
    .getByRole("listitem")
    .filter({ has: page.getByRole("heading", { name: title }) });
  await resource.getByLabel("Attachment file").setInputFiles({
    name: `preview-${runId}.md`,
    mimeType: "text/markdown",
    buffer: Buffer.from("# Preview-only attachment\n"),
  });
  await resource.getByRole("button", { name: "Attach", exact: true }).click();
  await expect(resource.getByText("Attachment uploaded.")).toBeVisible();
  const attachmentLink = resource.getByRole("link", {
    name: new RegExp(`preview-${runId}`),
  });
  await expect(attachmentLink).toBeVisible();
  const attachmentHref = await attachmentLink.getAttribute("href");
  expect(attachmentHref).toBeTruthy();

  const anonymousContext = await browser.newContext();
  const anonymousPage = await anonymousContext.newPage();
  await grantPreviewAccess(anonymousPage);
  const deniedCourse = await anonymousPage.goto(courseUrl.toString());
  expect(deniedCourse?.status()).toBe(404);
  const deniedAttachment = await anonymousPage.goto(
    new URL(attachmentHref!, courseUrl).toString(),
  );
  expect(deniedAttachment?.status()).toBe(404);
  await anonymousContext.close();

  const settingsUrl = new URL(courseUrl);
  settingsUrl.search = "";
  settingsUrl.pathname = `${settingsUrl.pathname}/settings`;

  const exportResult = await page.evaluate(async (url) => {
    const response = await fetch(url);
    return { status: response.status, payload: await response.json() };
  }, new URL("/api/account/export", courseUrl).toString());
  expect(exportResult.status).toBe(200);
  expect(exportResult.payload).toMatchObject({
    profile: { email },
  });

  await page.goto(settingsUrl.toString());
  await expect(page.getByLabel("University and degree program")).toBeVisible();
  const editedCourseName = `${courseName} edited`;
  await page.getByLabel("Local course name").fill(editedCourseName);
  await Promise.all([
    page.waitForURL(/\/settings\?saved=1/),
    page.getByRole("button", { name: "Save settings" }).click(),
  ]);
  await expect(page.getByText("Course settings saved.")).toBeVisible();
  await page.goto(courseUrl.toString());
  await expect(
    page.getByRole("heading", { level: 1, name: editedCourseName }),
  ).toBeVisible();

  await page.goto(settingsUrl.toString());
  await page.getByText("Archive course", { exact: true }).click();
  await page.getByRole("button", { name: "Confirm archive" }).click();
  await page.waitForURL(/\/my-courses\?status=archived/);
  const archivedCourse = page
    .getByRole("listitem")
    .filter({ has: page.getByRole("heading", { name: editedCourseName }) });
  await archivedCourse.getByRole("button", { name: "Restore course" }).click();
  await page.waitForURL(/\/courses\/.+\/settings/);

  await page.getByText("Archive course", { exact: true }).click();
  await page.getByRole("button", { name: "Confirm archive" }).click();
  await page.waitForURL(/\/my-courses\?status=archived/);
  const restoredThenArchived = page
    .getByRole("listitem")
    .filter({ has: page.getByRole("heading", { name: editedCourseName }) });
  await restoredThenArchived
    .getByText("Delete permanently", { exact: true })
    .click();
  await restoredThenArchived
    .getByLabel(new RegExp(`Type .*${runId}.* to confirm`))
    .fill(editedCourseName);
  await restoredThenArchived
    .getByRole("button", { name: "Delete all course data" })
    .click();
  await page.waitForURL(/\/my-courses\?status=deleted/);
  await expect(
    page.getByRole("heading", { name: editedCourseName }),
  ).toHaveCount(0);
});
