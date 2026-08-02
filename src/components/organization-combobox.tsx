"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import {
  organizationResultSchema,
  type OrganizationResult,
} from "@/lib/organizations/schema";

type SearchState = "idle" | "loading" | "ready" | "empty" | "error";

export function OrganizationCombobox({
  name = "organizationSelection",
  label = "University",
  countryCode,
  defaultOrganization = null,
  required = true,
  requestEnabled = true,
  onSelectionChange,
}: {
  name?: string;
  label?: string;
  countryCode?: string;
  defaultOrganization?: OrganizationResult | null;
  required?: boolean;
  requestEnabled?: boolean;
  onSelectionChange?: (organization: OrganizationResult | null) => void;
}) {
  const inputId = useId();
  const listboxId = useId();
  const statusId = useId();
  const abortRef = useRef<AbortController | null>(null);
  const [query, setQuery] = useState(defaultOrganization?.displayName ?? "");
  const [selected, setSelected] = useState<OrganizationResult | null>(
    defaultOrganization,
  );
  const [results, setResults] = useState<OrganizationResult[]>([]);
  const [state, setState] = useState<SearchState>("idle");
  const [activeIndex, setActiveIndex] = useState(-1);
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestStatus, setRequestStatus] = useState<
    "idle" | "sending" | "sent" | "error"
  >("idle");
  const [requestCity, setRequestCity] = useState("");
  const [requestWebsite, setRequestWebsite] = useState("");

  const runSearch = useCallback(
    async (value: string) => {
      abortRef.current?.abort();
      if (value.trim().length < 2 || selected?.displayName === value) {
        setResults([]);
        setState("idle");
        setActiveIndex(-1);
        return;
      }
      const controller = new AbortController();
      abortRef.current = controller;
      setState("loading");
      try {
        const params = new URLSearchParams({ q: value.trim() });
        if (countryCode) params.set("country", countryCode);
        const response = await fetch(`/api/organizations/search?${params}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("search_failed");
        const payload = (await response.json()) as { results?: unknown[] };
        const normalized = (payload.results ?? [])
          .map((item) => organizationResultSchema.safeParse(item))
          .filter((item) => item.success)
          .map((item) => item.data);
        setResults(normalized);
        setState(normalized.length ? "ready" : "empty");
        setActiveIndex(normalized.length ? 0 : -1);
      } catch (error) {
        if (controller.signal.aborted) return;
        setResults([]);
        setState("error");
        setActiveIndex(-1);
      }
    },
    [countryCode, selected?.displayName],
  );

  useEffect(() => {
    const timeout = window.setTimeout(() => void runSearch(query), 300);
    return () => {
      window.clearTimeout(timeout);
      abortRef.current?.abort();
    };
  }, [query, runSearch]);

  function choose(result: OrganizationResult) {
    setSelected(result);
    setQuery(result.displayName);
    setResults([]);
    setState("idle");
    setActiveIndex(-1);
    setRequestOpen(false);
    onSelectionChange?.(result);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!results.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (index <= 0 ? results.length - 1 : index - 1));
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      choose(results[activeIndex]);
    } else if (event.key === "Escape") {
      setResults([]);
      setState("idle");
      setActiveIndex(-1);
    }
  }

  async function requestOrganization() {
    setRequestStatus("sending");
    const response = await fetch("/api/organizations/request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: query,
        countryCode: countryCode || undefined,
        city: requestCity || undefined,
        websiteUrl: requestWebsite || undefined,
      }),
    });
    setRequestStatus(response.ok ? "sent" : "error");
  }

  const activeId =
    activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined;
  const statusText =
    state === "loading"
      ? "Searching universities"
      : state === "ready"
        ? `${results.length} universities found`
        : state === "empty"
          ? "No universities found"
          : state === "error"
            ? "University search unavailable"
            : selected
              ? `${selected.displayName} selected`
              : "Type at least two characters and select a university";

  return (
    <div className="relative">
      <label htmlFor={inputId} className="block text-sm font-semibold">
        {label}
      </label>
      <input
        id={inputId}
        role="combobox"
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-expanded={results.length > 0}
        aria-activedescendant={activeId}
        aria-describedby={statusId}
        value={query}
        required={required}
        autoComplete="off"
        onChange={(event) => {
          setQuery(event.target.value);
          if (selected && event.target.value !== selected.displayName) {
            setSelected(null);
            onSelectionChange?.(null);
          }
          setRequestOpen(false);
          setRequestStatus("idle");
        }}
        onKeyDown={handleKeyDown}
        placeholder="Search worldwide universities…"
        className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm shadow-sm focus:border-indigo-500"
      />
      <input
        type="hidden"
        name={name}
        value={selected ? JSON.stringify(selected) : ""}
      />
      <p id={statusId} className="sr-only" aria-live="polite">
        {statusText}
      </p>

      {state === "loading" ? (
        <div className="mt-2 min-h-20 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500 shadow-lg">
          Searching…
        </div>
      ) : null}
      {results.length ? (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="University results"
          className="absolute z-50 mt-2 max-h-80 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl"
        >
          {results.map((result, index) => (
            <li
              key={result.localId ?? result.rorId ?? `${result.displayName}-${index}`}
              id={`${listboxId}-option-${index}`}
              role="option"
              aria-selected={activeIndex === index}
            >
              <button
                type="button"
                onPointerMove={() => setActiveIndex(index)}
                onClick={() => choose(result)}
                className={`min-h-14 w-full rounded-lg px-3 py-2 text-left transition ${
                  activeIndex === index ? "bg-indigo-50" : "hover:bg-slate-50"
                }`}
              >
                <span className="flex items-start justify-between gap-3">
                  <span>
                    <span className="block font-semibold text-slate-950">
                      {result.displayName}
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-600">
                      {[result.city, result.region, result.countryName ?? result.countryCode]
                        .filter(Boolean)
                        .join(", ")}
                    </span>
                    {result.domains[0] || result.websiteUrl ? (
                      <span className="mt-0.5 block truncate text-xs text-slate-500">
                        {result.domains[0] ?? result.websiteUrl}
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase text-slate-600">
                    {result.source === "local" ? "Local" : "ROR"}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {state === "error" ? (
        <div className="mt-2 flex min-h-14 items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Search is temporarily unavailable.
          <button type="button" onClick={() => void runSearch(query)} className="min-h-11 rounded-lg border border-amber-300 px-3 font-semibold">
            Retry
          </button>
        </div>
      ) : null}
      {state === "empty" && requestEnabled ? (
        <div className="mt-2 rounded-xl border border-slate-200 bg-white p-3 text-sm">
          <p>No verified university matches this search.</p>
          <button
            type="button"
            onClick={() => setRequestOpen((open) => !open)}
            className="mt-2 min-h-11 rounded-lg border border-slate-300 px-3 font-semibold"
          >
            University not found
          </button>
        </div>
      ) : null}
      {requestOpen ? (
        <div className="mt-2 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs leading-5 text-slate-600">
            This creates a review request. It does not silently verify typed text.
          </p>
          <input value={requestCity} onChange={(event) => setRequestCity(event.target.value)} placeholder="City (optional)" className="min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm" />
          <input value={requestWebsite} onChange={(event) => setRequestWebsite(event.target.value)} type="url" placeholder="Official website (optional)" className="min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm" />
          <button type="button" onClick={() => void requestOrganization()} disabled={requestStatus === "sending" || requestStatus === "sent"} className="min-h-11 rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white disabled:opacity-60">
            {requestStatus === "sending"
              ? "Sending…"
              : requestStatus === "sent"
                ? "Request sent"
                : "Send for review"}
          </button>
          {requestStatus === "error" ? <p role="alert" className="text-xs text-red-700">The request could not be sent. Try again.</p> : null}
        </div>
      ) : null}
    </div>
  );
}
