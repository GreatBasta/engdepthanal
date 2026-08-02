"use client";

import { useCallback, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { OrganizationCombobox } from "@/components/organization-combobox";
import type { OrganizationResult } from "@/lib/organizations/schema";

export function CourseOrganizationFilter({
  defaultOrganization,
}: {
  defaultOrganization: OrganizationResult | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const updateOrganization = useCallback(
    (organization: OrganizationResult | null) => {
      const params = new URLSearchParams(searchParams.toString());
      const identifier = organization?.localId ?? organization?.rorId;
      if (identifier) params.set("organization", identifier);
      else params.delete("organization");
      params.set("scope", "all");
      params.delete("page");
      const suffix = params.toString();
      startTransition(() => router.replace(suffix ? `${pathname}?${suffix}` : pathname));
    },
    [pathname, router, searchParams],
  );

  return (
    <div className="min-w-0">
      <OrganizationCombobox
        defaultOrganization={defaultOrganization}
        label="University"
        name="directoryOrganization"
        onSelectionChange={updateOrganization}
        requestEnabled={false}
        required={false}
      />
      <p aria-live="polite" className="mt-1 min-h-5 text-xs text-slate-500">
        {pending ? "Updating course groups…" : "Leave empty to include every university."}
      </p>
    </div>
  );
}
