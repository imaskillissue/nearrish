/**
 * NextAuth v5 (beta) configuration for the NEAR app.
 *
 * Authentication strategy: JWT (JSON Web Token) stored in an HttpOnly cookie.
 * There is no server-side session table — the token itself carries the user's ID.
 *
 * Provider: Credentials (email + password only).
 *   - `authorize()` looks up the user in Postgres via Prisma, then verifies
 *     the plaintext password against the stored bcrypt hash.
 *   - On success it returns { id, email, name }, which NextAuth encodes into the JWT.
 *   - On failure it returns null, and NextAuth rejects the sign-in.
 *
 * JWT Callbacks (run on every request that touches the session):
 *   - `jwt`     — bakes user.id → token.userId when the token is first created,
 *                 so the DB id survives across page refreshes without DB round-trips.
 *   - `session` — promotes token.userId → session.user.id so client components
 *                 (e.g. useSession()) can read the logged-in user's DB id directly.
 *
 * Named exports consumed by the rest of the app:
 *   - `handlers` → mounted in app/api/auth/[...nextauth]/route.ts
 *   - `auth`     → server-side session check: `const session = await auth()`
 *   - `signIn`   → called from the registration and login forms
 *   - `signOut`  → called from the ProfileDropdown logout button
 */
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import prisma from './prisma';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      // Field definitions used by the default NextAuth login page.
      // NEAR uses a custom modal instead, but these are still required for types.
      credentials: {
        email:    { label: 'Email',    type: 'email'    },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const email    = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        // Retrieve the user record (we only select what we need; password is excluded
        // from all other queries, but here we need it to verify the hash).
        const user = await prisma.user.findUnique({
          where:  { email: email.toLowerCase() },
          select: { id: true, email: true, name: true, password: true },
        });
        if (!user) return null;

        // bcrypt.compare is timing-safe and handles the salt extraction automatically
        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) return null;

        // This object is encoded into the JWT — NEVER include the password hash here
        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],

  // Store the session in a signed, HttpOnly JWT cookie (not a DB sessions table)
  session: { strategy: 'jwt' },

  callbacks: {
    // Called every time the JWT is created or refreshed.
    // `user` is only present on the initial sign-in; after that only `token` exists.
    jwt({ token, user }) {
      if (user?.id) token.userId = user.id;
      return token;
    },
    // Called every time session data is read client-side (useSession) or server-side (auth()).
    // Without this, session.user would only contain name/email/image from the default JWT.
    session({ session, token }) {
      if (token.userId) session.user.id = token.userId as string;
      return session;
    },
  },

  // Custom sign-in page route. Our app handles login via a modal, but this
  // prevents NextAuth from redirecting to the default /api/auth/signin page.
  pages: {
    signIn: '/login',
  },
});
