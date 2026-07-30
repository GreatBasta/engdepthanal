import { redirect } from "next/navigation";

/** Low-sample legacy gap analytics are hidden for the launch. */
export default async function LegacyGaps({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/subjects/${slug}`);
}
