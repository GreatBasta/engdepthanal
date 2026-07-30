import { redirect } from "next/navigation";

/** Gesture-only legacy capture is retired; records remain untouched. */
export default async function LegacySwipe({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/subjects/${slug}`);
}
