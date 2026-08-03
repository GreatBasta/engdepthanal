import Link from "next/link";
import { redirect } from "next/navigation";

import { currentAdmin } from "@/lib/admin";
import { getAdminCatalogData } from "@/lib/catalog/review";

import {
  addCatalogSourceAction,
  approveCatalogDomainAction,
  mergeCatalogCandidateAction,
  retryCatalogScanAction,
  reviewCatalogCandidateAction,
  reviewCatalogCorrectionAction,
  setCatalogConnectorActiveAction,
} from "./actions";

const inputClass =
  "min-h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm";

export default async function AdminCatalogPage() {
  const admin = await currentAdmin();
  if (!admin) redirect("/admin/login");
  const data = await getAdminCatalogData();
  const matchesByCandidate = new Map(
    data.matches.map((match) => [match.candidateId, match]),
  );

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <Link href="/admin" className="text-sm text-indigo-700 hover:underline">
        ← Admin console
      </Link>
      <h1 className="mt-5 text-3xl font-bold">Official catalog administration</h1>
      <p className="mt-2 max-w-3xl text-sm text-zinc-600">
        Approve only domains and providers linked by the institution. Candidate
        evidence remains separate from Course Atlas pages and community curricula.
      </p>

      <section className="mt-8 grid gap-4 lg:grid-cols-2">
        <form action={approveCatalogDomainAction} className="rounded-2xl border p-5">
          <h2 className="font-bold">Approve external catalog domain</h2>
          <p className="mt-1 text-xs text-zinc-500">
            The evidence URL must be on an already verified university domain.
          </p>
          <div className="mt-4 space-y-3">
            <OrganizationSelect organizations={data.organizations} />
            <input name="domain" required placeholder="catalog-provider.example" className={inputClass} />
            <input name="evidenceUrl" type="url" required placeholder="Official university page linking this provider" className={inputClass} />
            <button className="min-h-11 rounded-lg bg-indigo-600 px-4 text-sm font-bold text-white">
              Approve domain
            </button>
          </div>
        </form>
        <form action={addCatalogSourceAction} className="rounded-2xl border p-5">
          <h2 className="font-bold">Add reviewed catalog source</h2>
          <div className="mt-4 space-y-3">
            <OrganizationSelect organizations={data.organizations} />
            <input name="sourceUrl" type="url" required placeholder="https://catalog.example.edu/courses" className={inputClass} />
            <select name="sourceType" className={inputClass} defaultValue="official_catalog">
              <option value="official_api">Official structured API</option>
              <option value="structured_data">Schema.org structured data</option>
              <option value="sitemap">XML sitemap</option>
              <option value="official_catalog">Official HTML catalog</option>
            </select>
            <button className="min-h-11 rounded-lg bg-indigo-600 px-4 text-sm font-bold text-white">
              Add source
            </button>
          </div>
        </form>
      </section>

      <AdminSection title="Approved boundaries" count={data.domains.length}>
        {data.domains.map((domain) => (
          <li key={domain.id} className="rounded-xl border p-4 text-sm">
            <p className="font-bold">{domain.organizationName} · {domain.domain}</p>
            <p className="mt-1 text-xs text-zinc-500">
              {domain.approved ? "Approved" : "Pending"} · {domain.boundarySource}
            </p>
            {domain.evidenceUrl ? <a href={domain.evidenceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-indigo-700 underline">Evidence link</a> : null}
          </li>
        ))}
      </AdminSection>

      <AdminSection title="Catalog sources and connectors" count={data.sources.length}>
        {data.sources.map((source) => (
          <li key={source.id} className="rounded-xl border p-4 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-bold">{source.organizationName}</p>
                <a href={source.sourceUrl} target="_blank" rel="noreferrer" className="break-all text-indigo-700 underline">{source.sourceUrl}</a>
                <p className="mt-1 text-xs text-zinc-500">
                  {source.sourceType} · {source.connectorId} · robots {source.robotsStatus}
                </p>
                {source.lastFailure ? <p className="mt-2 text-xs text-red-700">{source.lastFailure}</p> : null}
              </div>
              <form action={setCatalogConnectorActiveAction}>
                <input type="hidden" name="organizationId" value={source.organizationId} />
                <input type="hidden" name="connectorId" value={source.connectorId} />
                <input type="hidden" name="active" value={source.active ? "false" : "true"} />
                <button className="min-h-11 rounded-lg border px-3 text-xs font-bold">
                  {source.active ? "Disable connector" : "Enable connector"}
                </button>
              </form>
            </div>
          </li>
        ))}
      </AdminSection>

      <AdminSection title="Course candidates" count={data.candidates.length}>
        {data.candidates.map((candidate) => {
          const match = matchesByCandidate.get(candidate.id);
          return (
            <li key={candidate.id} className="rounded-xl border p-4 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-bold">{candidate.name}</p>
                  <p className="text-xs text-zinc-500">
                    {candidate.organizationName} · {candidate.code ?? "no code"} · {candidate.academicYear ?? "no year"} · confidence {Math.round(Number(candidate.confidence) * 100)}%
                  </p>
                  <a href={candidate.officialUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-indigo-700 underline">Open official source</a>
                </div>
                <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-bold">{candidate.status}</span>
              </div>
              <details className="mt-3">
                <summary className="min-h-11 cursor-pointer py-3 font-semibold">Extracted evidence</summary>
                <ul className="space-y-1 border-l-2 pl-3 text-xs">
                  {candidate.evidence.map((item, index) => <li key={`${item.field}-${index}`}><strong>{item.field}:</strong> {item.value} <span className="text-zinc-500">({item.signal})</span></li>)}
                </ul>
              </details>
              <div className="mt-3 flex flex-wrap gap-2">
                <form action={reviewCatalogCandidateAction}>
                  <input type="hidden" name="candidateId" value={candidate.id} />
                  <button name="decision" value="confirm" className="min-h-11 rounded-lg bg-emerald-600 px-3 text-xs font-bold text-white">Confirm</button>
                  <button name="decision" value="reject" className="ml-2 min-h-11 rounded-lg border px-3 text-xs font-bold">Reject</button>
                </form>
                {match ? (
                  <form action={mergeCatalogCandidateAction}>
                    <input type="hidden" name="candidateId" value={candidate.id} />
                    <input type="hidden" name="coursePageId" value={match.coursePageId} />
                    <button className="min-h-11 rounded-lg border border-indigo-300 px-3 text-xs font-bold text-indigo-700">
                      Match to {match.courseName} ({Math.round(Number(match.score) * 100)}%)
                    </button>
                  </form>
                ) : null}
              </div>
            </li>
          );
        })}
      </AdminSection>

      <AdminSection title="Proposed corrections" count={data.corrections.length}>
        {data.corrections.map((correction) => (
          <li key={correction.id} className="rounded-xl border p-4 text-sm">
            <p className="font-bold">{correction.candidateName}</p>
            <p className="mt-1 text-zinc-600">{correction.note}</p>
            <form action={reviewCatalogCorrectionAction} className="mt-3">
              <input type="hidden" name="correctionId" value={correction.id} />
              <button name="decision" value="accept" className="min-h-11 rounded-lg bg-emerald-600 px-3 text-xs font-bold text-white">Accept report</button>
              <button name="decision" value="reject" className="ml-2 min-h-11 rounded-lg border px-3 text-xs font-bold">Reject</button>
            </form>
          </li>
        ))}
      </AdminSection>

      <AdminSection title="Scan logs" count={data.scans.length}>
        {data.scans.map((scan) => (
          <li key={scan.id} className="rounded-xl border p-4 text-sm">
            <p className="font-bold">{scan.organizationName} · {scan.status}</p>
            <p className="mt-1 text-xs text-zinc-500">{scan.pages} pages · {scan.courses} candidates · requested {scan.requestedAt.toISOString()}</p>
            {scan.warnings.length ? <ul className="mt-2 list-disc pl-5 text-xs text-amber-800">{scan.warnings.map((warning, index) => <li key={`${warning}-${index}`}>{warning}</li>)}</ul> : null}
            {scan.failure ? <p className="mt-2 text-xs text-red-700">{scan.failure}</p> : null}
            {(scan.status === "failed" || scan.status === "partial") ? (
              <form action={retryCatalogScanAction} className="mt-3">
                <input type="hidden" name="organizationId" value={scan.organizationId} />
                <button className="min-h-11 rounded-lg border px-3 text-xs font-bold">Retry scan</button>
              </form>
            ) : null}
          </li>
        ))}
      </AdminSection>
    </main>
  );
}

function OrganizationSelect({ organizations }: { organizations: Array<{ id: string; name: string }> }) {
  return (
    <select name="organizationId" required className={inputClass} defaultValue="">
      <option value="" disabled>Select organization</option>
      {organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}
    </select>
  );
}

function AdminSection({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-xl font-bold">{title} <span className="text-sm font-medium text-zinc-500">({count})</span></h2>
      <ul className="mt-3 grid gap-3 lg:grid-cols-2">{children}</ul>
    </section>
  );
}
