import { LegalPage } from "@/components/legal-page";
export const metadata = { title: "Terms" };
export default function Page() {
  return <LegalPage title="Terms of use" intro="Course Atlas is a student-contributed, non-official learning platform. Universities and instructors do not endorse a page unless explicitly stated." sections={[
    { title: "Accuracy", body: "Course coverage, exam formats and recurring questions may be incomplete or outdated. Verify high-stakes information with official university sources." },
    { title: "Permitted use", body: "Use the service for lawful study and collaboration. Do not upload personal data, confidential assessments, stolen material or content you are not allowed to share." },
    { title: "Moderation", body: "We may hide or remove content and restrict accounts to protect users, intellectual property and assessment integrity. Actions are audited." },
  ]} />;
}
