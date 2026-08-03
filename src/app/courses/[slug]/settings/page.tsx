import { notFound } from "next/navigation";
import { and, asc, desc, eq, isNotNull } from "drizzle-orm";

import { currentStudentId } from "@/auth";
import { getCourseBySlugForViewer } from "@/lib/courses/data";
import { db } from "@/lib/db/client";
import {
  courseAttachments,
  programs,
  universities,
  universityPrograms,
} from "@/lib/db/schema";
import { OrganizationCombobox } from "@/components/organization-combobox";
import { getI18n } from "@/lib/i18n/server";
import { getPendingCourseMetadataReviews } from "@/lib/catalog/review";

import { archiveCourseAction, updateCourseSettingsAction } from "../actions";
import {
  moderateCourseContentAction,
  permanentlyDeleteCourseAttachmentAction,
} from "../community-actions";
import { reviewOfficialMetadataAction } from "./metadata-review-actions";

export default async function GeneralCourseSettings({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const [{ slug }, query, studentId, i18n] = await Promise.all([
    params,
    searchParams,
    currentStudentId(),
    getI18n(),
  ]);
  const { t, formatDate } = i18n;
  const detail = await getCourseBySlugForViewer(slug, studentId);
  if (!detail?.permissions.canManageCourseSettings) notFound();
  const [deletedAttachments, programOptions, organizationRows, metadataReviews] =
    await Promise.all([
      db
        .select({
          id: courseAttachments.id,
          fileName: courseAttachments.fileName,
          sizeBytes: courseAttachments.sizeBytes,
          deletedAt: courseAttachments.deletedAt,
        })
        .from(courseAttachments)
        .where(
          and(
            eq(courseAttachments.coursePageId, detail.course.id),
            isNotNull(courseAttachments.deletedAt),
          ),
        )
        .orderBy(desc(courseAttachments.deletedAt)),
      db
        .select({ slug: programs.slug, name: programs.name })
        .from(programs)
        .where(eq(programs.status, "verified"))
        .orderBy(asc(programs.name)),
      db
        .select({
          localId: universities.id,
          rorId: universities.rorId,
          canonicalName: universities.canonicalName,
          displayName: universities.displayName,
          fallbackName: universities.name,
          aliases: universities.aliases,
          acronyms: universities.acronyms,
          organizationType: universities.organizationType,
          city: universities.city,
          region: universities.region,
          countryCode: universities.countryCode,
          countryName: universities.countryName,
          domains: universities.domains,
          websiteUrl: universities.websiteUrl,
          externalSource: universities.externalSource,
          externalUpdatedAt: universities.externalUpdatedAt,
          verificationStatus: universities.status,
          programSlug: programs.slug,
        })
        .from(universityPrograms)
        .innerJoin(
          universities,
          eq(universityPrograms.universityId, universities.id),
        )
        .innerJoin(programs, eq(universityPrograms.programId, programs.id))
        .where(eq(universityPrograms.id, detail.course.universityProgramId))
        .limit(1),
      getPendingCourseMetadataReviews(detail.course.id, studentId!),
    ]);
  const organization = organizationRows[0];
  if (!organization) notFound();
  const canonicalName =
    organization.canonicalName ??
    organization.displayName ??
    organization.fallbackName;
  const defaultOrganization = {
    localId: organization.localId,
    rorId: organization.rorId,
    canonicalName,
    displayName: organization.displayName ?? canonicalName,
    aliases: organization.aliases,
    acronyms: organization.acronyms,
    organizationType: organization.organizationType ?? "education",
    city: organization.city,
    region: organization.region,
    countryCode: organization.countryCode,
    countryName: organization.countryName,
    domains: organization.domains,
    websiteUrl: organization.websiteUrl,
    source:
      organization.externalSource === "ror" && organization.rorId
        ? ("ror" as const)
        : ("local" as const),
    verified: organization.verificationStatus === "verified",
    externalUpdatedAt:
      organization.externalUpdatedAt?.toISOString().slice(0, 10) ?? null,
  };
  const input =
    "mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-slate-950";

  return (
    <div className="max-w-2xl space-y-6">
      {query.saved === "1" ? (
        <p
          role="status"
          className="rounded-xl bg-emerald-50 p-4 text-sm font-medium text-emerald-800"
        >
          {t("settings.saved")}
        </p>
      ) : null}
      {metadataReviews.length ? (
        <section className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-5">
          <h2 className="text-lg font-bold">{t("settings.officialUpdates")}</h2>
          <p className="mt-1 text-sm text-slate-600">
            {t("settings.officialUpdatesHelp")}
          </p>
          <ul className="mt-4 space-y-3">
            {metadataReviews.map((review) => (
              <li key={review.id} className="rounded-xl border border-indigo-100 bg-white p-4">
                <p className="font-bold">{review.candidateName}</p>
                <a href={review.sourceUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-sm text-indigo-700 underline">
                  {t("catalog.officialSource")}
                </a>
                <ul className="mt-3 space-y-1 text-xs text-slate-600">
                  {review.changedFields.map((change) => (
                    <li key={change.field}>
                      <strong>{change.field}:</strong> {String(change.before ?? "—")} → {String(change.after ?? "—")}
                    </li>
                  ))}
                </ul>
                <form action={reviewOfficialMetadataAction} className="mt-3 flex gap-2">
                  <input type="hidden" name="reviewId" value={review.id} />
                  <input type="hidden" name="courseSlug" value={slug} />
                  <button name="decision" value="accept" className="min-h-11 rounded-lg bg-indigo-600 px-3 text-xs font-bold text-white">
                    {t("settings.acceptOfficial")}
                  </button>
                  <button name="decision" value="reject" className="min-h-11 rounded-lg border border-slate-300 px-3 text-xs font-bold">
                    {t("settings.keepCommunity")}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <form
        action={updateCourseSettingsAction}
        className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <input type="hidden" name="coursePageId" value={detail.course.id} />
        <input type="hidden" name="courseSlug" value={slug} />
        <input type="hidden" name="returnTo" value="general" />
        <input
          type="hidden"
          name="universityProgramId"
          value={detail.course.universityProgramId}
        />
        <OrganizationCombobox
          name="organizationSelection"
          defaultOrganization={defaultOrganization}
        />
        <label className="block text-sm font-semibold">
          {t("settings.degree")}
          <select
            name="programSlug"
            defaultValue={organization.programSlug}
            className={input}
          >
            {programOptions.map((option) => (
              <option key={option.slug} value={option.slug}>
                {option.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-semibold">
          {t("settings.localName")}
          <input
            name="localName"
            required
            defaultValue={detail.course.localName}
            className={input}
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-semibold">
            {t("settings.code")}
            <input
              name="courseCode"
              defaultValue={detail.course.courseCode ?? ""}
              className={input}
            />
          </label>
          <label className="block text-sm font-semibold">
            {t("course.professor")}
            <input
              name="professorName"
              defaultValue={detail.course.professorName ?? ""}
              className={input}
            />
          </label>
          <label className="block text-sm font-semibold">
            {t("course.academicYear")}
            <input
              name="academicYear"
              required
              defaultValue={detail.course.academicYear}
              className={input}
            />
          </label>
          <label className="block text-sm font-semibold">
            {t("settings.cohortYear")}
            <input
              name="cohortYear"
              type="number"
              min={2000}
              max={2100}
              defaultValue={detail.course.cohortYear ?? ""}
              className={input}
            />
          </label>
          <label className="block text-sm font-semibold">
            {t("course.semester")}
            <input
              name="semester"
              type="number"
              min={1}
              max={12}
              defaultValue={detail.course.semester ?? ""}
              className={input}
            />
          </label>
        </div>
        <label className="block text-sm font-semibold">
          {t("settings.description")}
          <textarea
            name="description"
            rows={5}
            defaultValue={detail.course.description ?? ""}
            className={`${input} py-3`}
          />
        </label>
        <input
          type="hidden"
          name="visibility"
          value={detail.course.visibility}
        />
        <button className="min-h-11 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white">
          {t("settings.save")}
        </button>
      </form>

      {deletedAttachments.length ? (
        <section className="rounded-2xl border border-rose-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold">
            {t("settings.hiddenAttachments")}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {t("settings.hiddenHelp")}
          </p>
          <ul className="mt-4 space-y-3">
            {deletedAttachments.map((attachment) => (
              <li
                key={attachment.id}
                className="flex flex-col gap-3 rounded-xl bg-rose-50 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="break-all text-sm font-semibold">
                    {attachment.fileName}
                  </p>
                  <p className="text-xs text-slate-500">
                    {Math.ceil(attachment.sizeBytes / 1024)} KB ·{" "}
                    {t("settings.hiddenOn", {
                      date: attachment.deletedAt
                        ? formatDate(attachment.deletedAt)
                        : t("course.notSpecified"),
                    })}
                  </p>
                </div>
                <div className="flex flex-wrap items-start gap-2">
                  <form action={moderateCourseContentAction}>
                    <input
                      type="hidden"
                      name="coursePageId"
                      value={detail.course.id}
                    />
                    <input type="hidden" name="courseSlug" value={slug} />
                    <input type="hidden" name="targetType" value="attachment" />
                    <input
                      type="hidden"
                      name="targetId"
                      value={attachment.id}
                    />
                    <input
                      type="hidden"
                      name="reason"
                      value="Restored from course settings"
                    />
                    <button
                      type="submit"
                      name="action"
                      value="restore"
                      className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold"
                    >
                      {t("common.restore")}
                    </button>
                  </form>
                  <details className="rounded-xl border border-rose-300 bg-white">
                    <summary className="flex min-h-11 cursor-pointer items-center px-4 text-sm font-semibold text-rose-800">
                      {t("settings.deletePermanent")}
                    </summary>
                    <form
                      action={permanentlyDeleteCourseAttachmentAction}
                      className="w-64 border-t border-rose-200 p-3"
                    >
                      <input
                        type="hidden"
                        name="coursePageId"
                        value={detail.course.id}
                      />
                      <input type="hidden" name="courseSlug" value={slug} />
                      <input
                        type="hidden"
                        name="attachmentId"
                        value={attachment.id}
                      />
                      <p className="text-xs text-slate-600">
                        {t("settings.deleteAttachmentHelp")}
                      </p>
                      <button
                        type="submit"
                        name="confirmation"
                        value="delete"
                        className="mt-3 min-h-11 w-full rounded-xl bg-rose-700 px-4 text-sm font-semibold text-white"
                      >
                        {t("settings.confirmDelete")}
                      </button>
                    </form>
                  </details>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {detail.permissions.role === "owner" ? (
        <section className="rounded-2xl border border-rose-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-rose-900">
            {t("settings.lifecycle")}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {t("settings.lifecycleHelp")}
          </p>
          <details className="mt-4 rounded-xl border border-rose-300">
            <summary className="flex min-h-11 cursor-pointer items-center px-4 text-sm font-semibold text-rose-800">
              {t("settings.archive")}
            </summary>
            <form
              action={archiveCourseAction}
              className="border-t border-rose-200 p-4"
            >
              <input
                type="hidden"
                name="coursePageId"
                value={detail.course.id}
              />
              <p className="text-sm text-slate-600">
                {t("settings.archiveHelp")}
              </p>
              <button className="mt-3 min-h-11 rounded-xl bg-rose-700 px-4 text-sm font-semibold text-white">
                {t("settings.confirmArchive")}
              </button>
            </form>
          </details>
        </section>
      ) : null}
    </div>
  );
}
