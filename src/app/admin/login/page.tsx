import { redirect } from "next/navigation";

/** Dedicated admin credentials were removed. Admins use normal accounts. */
export default function LegacyAdminLogin() {
  redirect("/login?next=/admin");
}
