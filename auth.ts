import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

function getAllowedEmails(): Set<string> {
  return new Set(
    (process.env.ALLOWED_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

function isAllowedEmail(email: string): boolean {
  return getAllowedEmails().has(email.trim().toLowerCase());
}

export const {
  handlers,
  auth,
  signIn,
  signOut,
} = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],

  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60,
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },

  callbacks: {
    authorized: async ({ auth: session, request }) => {
      const pathname = request.nextUrl.pathname;

      if (
        pathname === "/login" ||
        pathname.startsWith("/api/auth")
      ) {
        return true;
      }

      const email = session?.user?.email
        ?.trim()
        .toLowerCase();

      if (!email) {
        return false;
      }

      return isAllowedEmail(email);
    },

    async signIn({ account, profile, user }) {
      if (account?.provider !== "google") {
        return false;
      }

      const email = String(
        user.email ?? profile?.email ?? ""
      )
        .trim()
        .toLowerCase();

      if (!email) {
        return false;
      }

      const profileData = profile as
        | Record<string, unknown>
        | undefined;

      const emailVerified =
        typeof profileData?.email_verified === "boolean"
          ? profileData.email_verified
          : true;

      if (!emailVerified) {
        return false;
      }

      return isAllowedEmail(email);
    },

    async jwt({ token, user }) {
      if (user?.email) {
        token.email = user.email.trim().toLowerCase();
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user && token.email) {
        session.user.email = String(token.email)
          .trim()
          .toLowerCase();
      }

      return session;
    },

    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) {
        return `${baseUrl}${url}`;
      }

      try {
        if (new URL(url).origin === baseUrl) {
          return url;
        }
      } catch {
        return baseUrl;
      }

      return baseUrl;
    },
  },
});
