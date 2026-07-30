import { LegalPage } from "@/components/legal-page";
export const metadata = { title: "Copyright and removal" };
export default function Page() {
  return <LegalPage title="Copyright and removal" intro="Only upload material you created, that is openly licensed, in the public domain, or that you have permission to share." sections={[
    { title: "Removal request", body: "Send the course URL, resource URL, a description of the protected work, your contact details and a good-faith statement through the Contact page." },
    { title: "Response", body: "Reported material may be soft-hidden while reviewed. Confirmed infringement can be permanently removed from both database metadata and object storage, with an audit record." },
    { title: "Counter-information", body: "Contributors may provide evidence of ownership, license or permission. Repeated abuse may result in account restrictions." },
  ]} />;
}
