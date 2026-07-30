import { LegalPage } from "@/components/legal-page";
export const metadata = { title: "Community Guidelines" };
export default function Page() {
  return <LegalPage title="Community Guidelines" intro="Make each contribution useful, contextual and safe for other students." sections={[
    { title: "Contribute responsibly", body: "Attach notes to the relevant course, topic, subtopic or exam. Explain corrections clearly and distinguish personal experience from verified facts." },
    { title: "Respect people and privacy", body: "No harassment, impersonation, doxxing, personal information, discriminatory content or targeted abuse." },
    { title: "Protect assessment integrity", body: "Do not share unauthorized exam material. Recurring-question reports must describe your own experience without claiming certainty." },
    { title: "Report reasons", body: "Reports may use: spam, harassment, personal information, copyright, unauthorized exam material, incorrect information, inappropriate content, or other." },
  ]} />;
}
