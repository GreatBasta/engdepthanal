import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";

import { currentStudentId } from "@/auth";
import { db } from "@/lib/db/client";
import { students } from "@/lib/db/schema";

/**
 * Admin access, two ways:
 *  1. A dedicated admin login (username + password) whose credentials live in
 *     the ADMIN_USERNAME / ADMIN_PASSWORD env vars — never in the repo. On
 *     success we set a signed, httpOnly cookie (HMAC over the credentials with
 *     AUTH_SECRET), so it can't be forged and invalidates if the password
 *     changes.
 *  2. A student whose email is in the ADMIN_EMAILS allowlist (kept from the
 *     first version, handy for granting access to normal accounts).
 */

export const ADMIN_COOKIE = "eda_admin";

function allowlist(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

function envCreds() {
  return {
    user: process.env.ADMIN_USERNAME ?? "",
    pass: process.env.ADMIN_PASSWORD ?? "",
  };
}

/** The username/password admin login is available only once both env vars are set. */
export function adminLoginEnabled(): boolean {
  const { user, pass } = envCreds();
  return Boolean(user && pass && process.env.AUTH_SECRET);
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

/** The opaque session token for the configured credentials. */
export function adminTokenValue(): string {
  const { user, pass } = envCreds();
  return createHmac("sha256", process.env.AUTH_SECRET ?? "")
    .update(`admin:${user}:${pass}`)
    .digest("hex");
}

/** Check a submitted username + password against the env credentials. */
export function verifyAdminCredentials(user: string, pass: string): boolean {
  const c = envCreds();
  if (!c.user || !c.pass) return false;
  // Compare both fields (both constant-time) so neither leaks via timing.
  const okUser = safeEqual(user, c.user);
  const okPass = safeEqual(pass, c.pass);
  return okUser && okPass;
}

async function hasValidAdminCookie(): Promise<boolean> {
  if (!adminLoginEnabled()) return false;
  const value = (await cookies()).get(ADMIN_COOKIE)?.value;
  return Boolean(value && safeEqual(value, adminTokenValue()));
}

/** The current admin (via cookie login or student allowlist), else null. */
export async function currentAdmin(): Promise<{ label: string } | null> {
  if (await hasValidAdminCookie()) {
    return { label: process.env.ADMIN_USERNAME ?? "admin" };
  }

  const studentId = await currentStudentId();
  if (studentId) {
    const [student] = await db
      .select({ email: students.email })
      .from(students)
      .where(eq(students.id, studentId))
      .limit(1);
    if (student && allowlist().has(student.email.toLowerCase())) {
      return { label: student.email };
    }
  }
  return null;
}

/** True when the current request is from an admin (for conditional UI). */
export async function isAdmin(): Promise<boolean> {
  return (await currentAdmin()) !== null;
}
