"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useFormStatus } from "react-dom";

import { useI18n } from "@/components/locale-provider";
import type { getCatalogOverview } from "@/lib/catalog/repository";

import {
  confirmCatalogCandidateAction,
  proposeCatalogCorrectionAction,
  reportCatalogCandidateOutdatedAction,
} from "./catalog-actions";

type CatalogOverview = Awaited<ReturnType<typeof getCatalogOverview>>;
type CatalogCandidate = CatalogOverview["candidates"][number];

export function OfficialCatalogPanel({
  organizationId,
  overview,
  canRefresh,
}: {
  organizationId: string;
  overview: CatalogOverview;
  canRefresh: boolean;
}) {
  const { t, formatDate } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const confirmed = overview.candidates.filter(
    (candidate) => candidate.status === "confirmed" || candidate.status === "merged",
  );
  const review = overview.candidates.filter(
    (candidate) => candidate.status === "candidate" || candidate.status === "outdated",
  );
  const scanStatus = overview.latestScan?.status;

  const requestRefresh = () => {
    setMessage(null);
    startTransition(async () => {
      const response = await fetch("/api/catalog/scans", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId, force: true }),
      });
      setMessage(
        response.ok ? t("catalog.refreshRequested") : t("catalog.scanFailed"),
      );
      if (response.ok) router.refresh();
    });
  };

  return (
    <section className="mt-6 rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-950">{t("catalog.title")}</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            {t("catalog.subtitle")}
          </p>
          <p className="mt-2 text-xs font-medium text-slate-500">
            {t("catalog.lastCheck")}: {overview.latestScan?.finishedAt
              ? formatDate(overview.latestScan.finishedAt)
              : t("catalog.neverChecked")}
            {scanStatus === "queued" || scanStatus === "running"
              ? ` · ${t("catalog.scanRunning")}`
              : scanStatus === "partial"
                ? ` · ${t("catalog.scanPartial")}`
                : scanStatus === "failed"
                  ? ` · ${t("catalog.scanFailed")}`
                  : ""}
          </p>
        </div>
        {canRefresh ? (
          <button
            type="button"
            disabled={pending || scanStatus === "queued" || scanStatus === "running"}
            onClick={requestRefresh}
            className="min-h-11 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
          >
            {pending ? t("catalog.refreshing") : t("catalog.refresh")}
          </button>
        ) : null}
      </div>
      {message ? <p className="mt-3 text-sm font-medium" aria-live="polite">{message}</p> : null}
      <p className="mt-4 rounded-xl bg-white p-3 text-xs text-slate-600">
        {t("catalog.notAtlasPage")}
      </p>

      <CatalogCandidateList
        title={t("catalog.confirmed")}
        candidates={confirmed}
        authenticated={canRefresh}
      />
      <CatalogCandidateList
        title={t("catalog.needsReview")}
        candidates={review}
        authenticated={canRefresh}
      />
      {!confirmed.length && !review.length ? (
        <p className="mt-5 text-sm text-slate-600">{t("catalog.none")}</p>
      ) : null}
    </section>
  );
}

function CatalogCandidateList({
  title,
  candidates,
  authenticated,
}: {
  title: string;
  candidates: CatalogCandidate[];
  authenticated: boolean;
}) {
  if (!candidates.length) return null;
  return (
    <div className="mt-5">
      <h3 className="text-sm font-bold uppercase tracking-wide text-slate-600">{title}</h3>
      <div className="mt-2 grid gap-3 lg:grid-cols-2">
        {candidates.map((candidate) => (
          <CatalogCandidateCard
            key={candidate.id}
            candidate={candidate}
            authenticated={authenticated}
          />
        ))}
      </div>
    </div>
  );
}

function CatalogCandidateCard({
  candidate,
  authenticated,
}: {
  candidate: CatalogCandidate;
  authenticated: boolean;
}) {
  const { t, formatNumber } = useI18n();
  const statusLabel =
    candidate.status === "confirmed" || candidate.status === "merged"
      ? t("catalog.studentConfirmed")
      : candidate.status === "outdated"
        ? t("catalog.outdated")
        : t("catalog.needsReviewLabel");
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 className="font-bold text-slate-950">
            {candidate.name ?? candidate.canonicalName}
          </h4>
          <p className="mt-1 text-xs text-slate-500">
            {[candidate.code, candidate.programme, candidate.academicYear]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-700">
          {statusLabel}
        </span>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        {t("catalog.confidence", {
          value: formatNumber(Math.round(Number(candidate.confidence) * 100)),
        })}
      </p>
      <details className="mt-2 text-xs text-slate-600">
        <summary className="min-h-11 cursor-pointer py-3 font-semibold">
          {t("catalog.evidence")}
        </summary>
        <ul className="space-y-1 border-l-2 border-indigo-100 pl-3">
          {candidate.evidence.slice(0, 5).map((item, index) => (
            <li key={`${item.field}-${item.value}-${index}`}>
              <span className="font-semibold">{item.field}:</span> {item.value}
            </li>
          ))}
        </ul>
      </details>
      <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
        <a
          href={candidate.officialUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 px-3 text-indigo-700"
        >
          {t("catalog.officialSource")}
        </a>
        {candidate.communitySlug ? (
          <Link
            href={`/courses/${candidate.communitySlug}`}
            className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 px-3 text-slate-700"
          >
            {t("catalog.communityAvailable")}
          </Link>
        ) : candidate.status === "confirmed" ? (
          <Link
            href={`/courses/new?candidate=${candidate.id}`}
            className="inline-flex min-h-11 items-center rounded-lg bg-indigo-600 px-3 text-white"
          >
            {t("catalog.import")}
          </Link>
        ) : null}
      </div>
      {authenticated ? (
        <div className="mt-3 border-t border-slate-100 pt-3">
          {candidate.status === "candidate" ? (
            <form action={confirmCatalogCandidateAction}>
              <input type="hidden" name="candidateId" value={candidate.id} />
              <ActionSubmit className="min-h-11 text-xs font-bold text-emerald-700">
                {t("catalog.confirm")}
              </ActionSubmit>
            </form>
          ) : candidate.status === "confirmed" ? (
            <form action={reportCatalogCandidateOutdatedAction}>
              <input type="hidden" name="candidateId" value={candidate.id} />
              <ActionSubmit className="min-h-11 text-xs font-bold text-amber-700">
                {t("catalog.reportOutdated")}
              </ActionSubmit>
            </form>
          ) : null}
          <details className="mt-1">
            <summary className="min-h-11 cursor-pointer py-3 text-xs font-bold text-slate-700">
              {t("catalog.proposeCorrection")}
            </summary>
            <form action={proposeCatalogCorrectionAction} className="space-y-2">
              <input type="hidden" name="candidateId" value={candidate.id} />
              <textarea
                name="note"
                required
                minLength={4}
                maxLength={1_000}
                placeholder={t("catalog.correctionPlaceholder")}
                className="min-h-24 w-full rounded-lg border border-slate-300 p-3 text-sm"
              />
              <ActionSubmit className="min-h-11 rounded-lg border border-slate-300 px-3 text-xs font-bold">
                {t("catalog.sendCorrection")}
              </ActionSubmit>
            </form>
          </details>
        </div>
      ) : null}
    </article>
  );
}

function ActionSubmit({
  children,
  className,
}: {
  children: React.ReactNode;
  className: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`${className} disabled:opacity-50`}>
      {children}
    </button>
  );
}
