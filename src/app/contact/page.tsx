import { LegalPage } from "@/components/legal-page";
export const metadata = { title: "Contact" };
export default function Page() {
  return <LegalPage title="Contact" intro="Use in-product reports for specific contributions. For account, privacy, safety or copyright requests, contact the operator address configured for this deployment." sections={[
    { title: "Required deployment setting", body: "Set NEXT_PUBLIC_CONTACT_EMAIL to a monitored support address before production promotion. Until then, production release is blocked for external support requests." },
    { title: "Include", body: "Provide the relevant course or resource URL, the request category, and only the minimum personal information necessary to investigate." },
  ]} />;
}
