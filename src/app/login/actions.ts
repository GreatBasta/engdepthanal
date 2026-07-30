"use server";

import { AuthError } from "next-auth";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { signIn } from "@/auth";
import { db } from "@/lib/db/client";
import { students } from "@/lib/db/schema";
import { hashPassword } from "@/lib/password";
import { verifyPassword } from "@/lib/password";
import { consumeRateLimit } from "@/lib/rate-limit";

export interface AuthFormState {
  error: string | null;
}

const signUpSchema = z.object({
  displayName: z.string().trim().min(1, "Please enter your name").max(120),
  email: z.string().trim().toLowerCase().email("Please enter a valid email"),
  password: z
    .string()
    .min(10, "Password must be at least 10 characters")
    .max(128)
    .regex(/[a-z]/, "Add a lowercase letter")
    .regex(/[A-Z]/, "Add an uppercase letter")
    .regex(/[0-9]/, "Add a number"),
});

const signInSchema = z.object({
  email: z.string().trim().toLowerCase().email("Please enter a valid email"),
  password: z.string().min(1, "Please enter your password"),
});

/** Where a fresh login lands. Only same-app paths are honored. */
function safeNext(formData: FormData): string {
  const next = formData.get("next");
  return typeof next === "string" &&
    next.startsWith("/") &&
    !next.startsWith("//") &&
    !next.includes("\\")
    ? next
    : "/dashboard";
}

export async function signUpAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = signUpSchema.safeParse({
    displayName: formData.get("displayName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  const { displayName, email, password } = parsed.data;
  if (
    !(await consumeRateLimit({
      action: "signup",
      identifier: email,
      limit: 5,
      windowMinutes: 60,
    }))
  ) {
    return { error: "Too many attempts. Try again later." };
  }

  const [existing] = await db
    .select({ id: students.id })
    .from(students)
    .where(eq(students.email, email))
    .limit(1);
  if (existing) {
    return {
      error:
        "The account could not be created. Try signing in or use account recovery.",
    };
  }

  await db.insert(students).values({
    email,
    displayName,
    passwordHash: await hashPassword(password),
  });

  // New accounts always start at onboarding: university → course → phase.
  await signIn("credentials", { email, password, redirectTo: "/onboarding" });
  return { error: null }; // unreachable — signIn redirects
}

export async function signInAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  if (
    !(await consumeRateLimit({
      action: "login",
      identifier: parsed.data.email,
      limit: 10,
      windowMinutes: 15,
    }))
  ) {
    return { error: "Too many attempts. Try again in a few minutes." };
  }

  const [student] = await db
    .select({ passwordHash: students.passwordHash })
    .from(students)
    .where(eq(students.email, parsed.data.email))
    .limit(1);
  if (
    !student?.passwordHash ||
    !(await verifyPassword(parsed.data.password, student.passwordHash))
  ) {
    return { error: "Wrong email or password." };
  }

  try {
    await signIn("credentials", {
      ...parsed.data,
      redirectTo: safeNext(formData),
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: "Wrong email or password." };
    }
    throw err; // NEXT_REDIRECT on success — let Next.js handle it
  }
  return { error: null };
}
