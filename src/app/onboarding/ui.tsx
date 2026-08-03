"use client";

import { useActionState, useEffect, useId, useMemo, useRef, useState } from "react";

import { useI18n } from "@/components/locale-provider";
import { OrganizationCombobox } from "@/components/organization-combobox";
import type { AppLocale } from "@/lib/i18n/config";
import type {
  OnboardingProgrammeOption,
  OnboardingUnitOption,
} from "@/lib/onboarding/programmes";
import type { OrganizationResult } from "@/lib/organizations/schema";
import { completeOnboarding, type OnboardingFormState } from "./actions";

const initialState: OnboardingFormState = { error: null };

const THIS_YEAR = new Date().getFullYear();
const INTAKE_YEARS = [
  THIS_YEAR + 1,
  THIS_YEAR,
  THIS_YEAR - 1,
  THIS_YEAR - 2,
  THIS_YEAR - 3,
  THIS_YEAR - 4,
];

const inputClass =
  "min-h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm " +
  "focus:outline-none focus:ring-2 focus:ring-indigo-500 " +
  "dark:border-zinc-700 dark:bg-zinc-950";

interface TaxonomyOption {
  value: string;
  name: string;
  secondary: string | null;
  level: string;
  aliases: string[];
}

interface InstitutionPayload {
  organizationId: string | null;
  programmes: OnboardingProgrammeOption[];
  units: OnboardingUnitOption[];
  latestScan: {
    status: string;
    requestedAt: string;
    finishedAt: string | null;
  } | null;
}

type Choice =
  | (OnboardingProgrammeOption & { source: "institution" })
  | (TaxonomyOption & { source: "taxonomy" });

export function OnboardingForm({
  taxonomyOptions,
  defaultLocale,
}: {
  taxonomyOptions: TaxonomyOption[];
  defaultLocale: AppLocale;
}) {
  const { t, locale } = useI18n();
  const [state, dispatch, pending] = useActionState(
    completeOnboarding,
    initialState,
  );
  const listboxId = useId();
  const statusId = useId();
  const requestRef = useRef<AbortController | null>(null);
  const [organization, setOrganization] = useState<OrganizationResult | null>(
    null,
  );
  const [institution, setInstitution] = useState<InstitutionPayload | null>(null);
  const [catalogState, setCatalogState] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [query, setQuery] = useState("");
  const [choice, setChoice] = useState<Choice | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [customOpen, setCustomOpen] = useState(false);
  const [fallbackChoice, setFallbackChoice] = useState("");
  const [unitChoice, setUnitChoice] = useState("");

  useEffect(() => {
    requestRef.current?.abort();
    setInstitution(null);
    setCatalogState(organization ? "loading" : "idle");
    setQuery("");
    setChoice(null);
    setActiveIndex(-1);
    setCustomOpen(false);
    setFallbackChoice("");
    setUnitChoice("");
    if (!organization) return;
    const controller = new AbortController();
    requestRef.current = controller;
    void fetch("/api/onboarding/programmes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ organization }),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("programme_lookup_failed");
        return (await response.json()) as InstitutionPayload;
      })
      .then((payload) => {
        if (controller.signal.aborted) return;
        setInstitution(payload);
        setCatalogState("ready");
      })
      .catch(() => {
        if (!controller.signal.aborted) setCatalogState("error");
      });
    return () => controller.abort();
  }, [organization]);

  const choices = useMemo<Choice[]>(() => {
    const normalized = query.trim().toLocaleLowerCase(locale);
    const matches = (values: string[]) =>
      !normalized ||
      values.some((value) => value.toLocaleLowerCase(locale).includes(normalized));
    const official = (institution?.programmes ?? [])
      .filter((option) =>
        matches([option.name, option.secondary ?? ""]),
      )
      .map((option) => ({ ...option, source: "institution" as const }));
    const taxonomy = taxonomyOptions
      .filter((option) =>
        matches([option.name, option.secondary ?? "", ...option.aliases]),
      )
      .map((option) => ({ ...option, source: "taxonomy" as const }));
    return [...official, ...taxonomy].slice(0, 30);
  }, [institution?.programmes, locale, query, taxonomyOptions]);

  const domainFallbacks = taxonomyOptions.filter(
    (option) => option.level === "domain",
  );
  const activeId =
    activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined;
  const programmeValue = customOpen ? fallbackChoice : (choice?.value ?? "");

  function chooseProgramme(option: Choice) {
    setChoice(option);
    setQuery(option.name);
    setActiveIndex(-1);
    setCustomOpen(false);
    if (option.source === "institution" && option.unitChoice) {
      setUnitChoice(option.unitChoice);
    }
  }

  function handleProgrammeKeyDown(
    event: React.KeyboardEvent<HTMLInputElement>,
  ) {
    if (!choices.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % choices.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (index <= 0 ? choices.length - 1 : index - 1));
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      chooseProgramme(choices[activeIndex]);
    } else if (event.key === "Escape") {
      setActiveIndex(-1);
    }
  }

  const scanStatus = institution?.latestScan;
  const catalogMessage =
    catalogState === "loading"
      ? t("onboarding.catalogChecking")
      : catalogState === "error"
        ? t("onboarding.catalogUnavailable")
        : scanStatus
          ? t("onboarding.catalogStatus", {
              status: scanStatus.status,
              date: new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
                new Date(scanStatus.finishedAt ?? scanStatus.requestedAt),
              ),
            })
          : organization
            ? t("onboarding.catalogWillScan")
            : t("onboarding.selectUniversityFirst");

  return (
    <form action={dispatch} className="space-y-5">
      <OrganizationCombobox
        label={t("onboarding.yourUniversity")}
        onSelectionChange={setOrganization}
      />

      <div>
        <label htmlFor={`${listboxId}-input`} className="block">
          <span className="mb-1 block text-sm font-medium">
            {t("onboarding.degree")}
          </span>
          <input
            id={`${listboxId}-input`}
            role="combobox"
            aria-autocomplete="list"
            aria-controls={listboxId}
            aria-expanded={!customOpen && query.length > 0 && choices.length > 0}
            aria-activedescendant={activeId}
            aria-describedby={statusId}
            value={query}
            disabled={customOpen}
            autoComplete="off"
            onChange={(event) => {
              setQuery(event.target.value);
              if (choice?.name !== event.target.value) setChoice(null);
              setActiveIndex(0);
            }}
            onFocus={() => setActiveIndex(choices.length ? 0 : -1)}
            onKeyDown={handleProgrammeKeyDown}
            placeholder={t("onboarding.programmeSearchPlaceholder")}
            className={inputClass}
          />
        </label>
        <input type="hidden" name="programmeChoice" value={programmeValue} />
        <p id={statusId} className="mt-1 text-xs text-zinc-500" aria-live="polite">
          {catalogMessage}
        </p>

        {!customOpen && query.length > 0 && choices.length > 0 ? (
          <ul
            id={listboxId}
            role="listbox"
            aria-label={t("onboarding.programmeResults")}
            className="mt-2 max-h-80 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl dark:border-zinc-700 dark:bg-zinc-950"
          >
            {choices.map((option, index) => (
              <li
                id={`${listboxId}-option-${index}`}
                key={option.value}
                role="option"
                aria-selected={choice?.value === option.value}
              >
                <button
                  type="button"
                  onPointerMove={() => setActiveIndex(index)}
                  onClick={() => chooseProgramme(option)}
                  className={`min-h-14 w-full rounded-lg px-3 py-2 text-left transition ${
                    activeIndex === index
                      ? "bg-indigo-50 dark:bg-indigo-950/40"
                      : "hover:bg-slate-50 dark:hover:bg-zinc-900"
                  }`}
                >
                  <span className="flex items-start justify-between gap-3">
                    <span>
                      <span className="block text-sm font-semibold">{option.name}</span>
                      {option.secondary ? (
                        <span className="mt-0.5 block text-xs text-zinc-500">
                          {option.secondary}
                        </span>
                      ) : null}
                    </span>
                    <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-1 text-[10px] font-bold uppercase text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                      {option.source === "taxonomy"
                        ? t("onboarding.globalField")
                        : option.status === "official"
                          ? t("onboarding.officialProgramme")
                          : option.status === "needs_review"
                            ? t("catalog.needsReviewLabel")
                            : t("onboarding.localProgramme")}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <button
          type="button"
          onClick={() => {
            setCustomOpen((open) => !open);
            setChoice(null);
            setQuery("");
            setFallbackChoice("");
          }}
          className="mt-2 min-h-11 rounded-lg border border-zinc-300 px-3 text-sm font-semibold dark:border-zinc-700"
        >
          {customOpen ? t("common.cancel") : t("onboarding.programmeNotFound")}
        </button>
      </div>

      {customOpen ? (
        <section className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
          <p className="text-sm text-amber-900 dark:text-amber-100">
            {t("onboarding.programmeNotFoundHelp")}
          </p>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">
              {t("onboarding.programmeName")}
            </span>
            <input
              name="requestedProgrammeName"
              required
              maxLength={160}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">
              {t("onboarding.temporaryField")}
            </span>
            <select
              required
              value={fallbackChoice}
              onChange={(event) => setFallbackChoice(event.target.value)}
              className={inputClass}
            >
              <option value="">{t("onboarding.pickField")}</option>
              {domainFallbacks.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.name}
                </option>
              ))}
            </select>
          </label>
        </section>
      ) : null}

      <label className="block">
        <span className="mb-1 block text-sm font-medium">
          {t("onboarding.unitOptional")}
        </span>
        <select
          name="unitChoice"
          value={unitChoice}
          onChange={(event) => setUnitChoice(event.target.value)}
          disabled={!institution?.units.length}
          className={inputClass}
        >
          <option value="">{t("onboarding.noUnit")}</option>
          {(institution?.units ?? []).map((unit) => (
            <option key={unit.value} value={unit.value}>
              {unit.name} · {unit.type.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">
            {t("onboarding.intake")}
          </span>
          <select
            name="intakeYear"
            required
            defaultValue={THIS_YEAR}
            className={inputClass}
          >
            {INTAKE_YEARS.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">
            {t("onboarding.preferredLanguage")}
          </span>
          <select
            name="preferredLocale"
            defaultValue={defaultLocale}
            className={inputClass}
          >
            <option value="en">English</option>
            <option value="it">Italiano</option>
          </select>
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-sm font-medium">
          {t("onboarding.academicContextOptional")}
        </span>
        <input
          name="academicContext"
          maxLength={160}
          placeholder={t("onboarding.academicContextPlaceholder")}
          className={inputClass}
        />
      </label>

      <fieldset>
        <legend className="mb-2 block text-sm font-medium">
          {t("onboarding.phaseQuestion")}
        </legend>
        <div className="space-y-2">
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-300 p-3 transition has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50/50 has-[:checked]:ring-1 has-[:checked]:ring-indigo-500 dark:border-zinc-700 dark:has-[:checked]:bg-indigo-950/30">
            <input
              type="radio"
              name="phase"
              value="starting"
              required
              className="mt-1"
            />
            <span>
              <span className="block text-sm font-medium">
                {t("onboarding.starting")}
              </span>
              <span className="block text-xs text-zinc-600 dark:text-zinc-400">
                {t("onboarding.startingHelp")}
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-300 p-3 transition has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50/50 has-[:checked]:ring-1 has-[:checked]:ring-indigo-500 dark:border-zinc-700 dark:has-[:checked]:bg-indigo-950/30">
            <input
              type="radio"
              name="phase"
              value="attending"
              required
              className="mt-1"
            />
            <span>
              <span className="block text-sm font-medium">
                {t("onboarding.attending")}
              </span>
              <span className="block text-xs text-zinc-600 dark:text-zinc-400">
                {t("onboarding.attendingHelp")}
              </span>
            </span>
          </label>
        </div>
      </fieldset>

      {state.error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending || !organization || !programmeValue}
        className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:opacity-50"
      >
        {pending ? t("onboarding.submitting") : t("onboarding.submit")}
      </button>
    </form>
  );
}
