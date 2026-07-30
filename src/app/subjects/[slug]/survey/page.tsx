import { redirect } from "next/navigation";

/** Legacy survey is no longer writable; the subject slug is a reliable map. */
export default async function LegacySurvey({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/subjects/${slug}`);
}
