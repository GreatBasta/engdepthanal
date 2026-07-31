import { LegalPage } from "@/components/legal-page";
export const metadata = { title: "Privacy" };
export default function Page() {
  return <LegalPage title="Privacy" intro="We collect only the account, course-membership, progress, contribution, moderation and operational data needed to run the service." sections={[
    { title: "Private progress", body: "Personal subtopic progress is visible only to the member who created it. It is not included in public course analytics." },
    { title: "Course visibility", body: "Private courses require membership. Unlisted courses are omitted from public search and marked noindex. Public courses may be indexed." },
    { title: "Files and logs", body: "File bytes are stored in object storage, not Postgres. Private downloads pass through authorization. Logs must not include passwords, tokens, private URLs or unnecessary private content." },
    { title: "Your controls", body: "You can edit your profile, export your data, and request deletion from Profile. Account deletion anonymizes the login while preserving collaborative audit history." },
  ]} />;
}
