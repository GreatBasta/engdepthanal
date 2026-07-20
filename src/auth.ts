import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db/client";
import { students } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { verifyPassword } from "@/lib/password";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/**
 * Email + password auth with JWT sessions (no DB read per request).
 * The JWT carries `studentId`; every server component and action derives
 * the current student from the session — never from client input.
 *
 * Signup lives in a server action (`src/app/login/actions.ts`); this
 * provider only verifies existing accounts.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: env().AUTH_SECRET,
  session: { strategy: "jwt" },
  trustHost: true,
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        const [student] = await db
          .select()
          .from(students)
          .where(eq(students.email, email.toLowerCase()))
          .limit(1);
        if (!student?.passwordHash) return null;

        const ok = await verifyPassword(password, student.passwordHash);
        if (!ok) return null;

        return {
          id: student.id,
          email: student.email,
          name: student.displayName,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      const claims = token as typeof token & { studentId?: string };
      if (user?.id) claims.studentId = user.id;
      return claims;
    },
    session({ session, token }) {
      const claims = token as typeof token & { studentId: string };
      session.user.id = claims.studentId;
      return session;
    },
  },
});

/** The signed-in student's id, or null. */
export async function currentStudentId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}
