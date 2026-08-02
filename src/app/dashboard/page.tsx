import { redirect } from "next/navigation";

/** Legacy entry point retained as a reliable redirect. */
export default function DashboardPage() {
  redirect("/");
}
