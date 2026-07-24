"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  ADMIN_COOKIE,
  adminLoginEnabled,
  adminTokenValue,
  verifyAdminCredentials,
} from "@/lib/admin";

export interface AdminLoginState {
  error: string | null;
}

const schema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

/** Verify the admin username/password (from env) and set the signed cookie. */
export async function adminLogin(
  _prev: AdminLoginState,
  formData: FormData,
): Promise<AdminLoginState> {
  if (!adminLoginEnabled()) {
    return {
      error:
        "Admin login isn't configured. Set ADMIN_USERNAME and ADMIN_PASSWORD.",
    };
  }

  const parsed = schema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: "Enter a username and password." };
  }

  if (!verifyAdminCredentials(parsed.data.username, parsed.data.password)) {
    return { error: "Wrong username or password." };
  }

  (await cookies()).set(ADMIN_COOKIE, adminTokenValue(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
  redirect("/admin");
}

/** Clear the admin session. */
export async function adminLogout() {
  (await cookies()).delete(ADMIN_COOKIE);
  redirect("/admin/login");
}
