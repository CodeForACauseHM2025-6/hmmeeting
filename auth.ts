// auth.ts
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { DEV_USERS } from "@/src/config/devUsers";
import { ensureDevUsers } from "@/src/server/devSeed";

export const {
  handlers: { GET, POST }, // GET and POST handlers for the auth routes
  auth, // auth function to get the user's session
  signIn, // sign in function to sign in the user
  signOut, // sign out function to sign out the user
} = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    ...(process.env.NODE_ENV !== "production"
      ? [
          Credentials({
            id: "dev-credentials",
            name: "Dev Credentials",
            credentials: {
              email: { label: "Email", type: "text" },
            },
            async authorize(credentials) {
              if (process.env.NODE_ENV === "production") return null;
              const email = String(credentials?.email ?? "").trim().toLowerCase();
              const devUser = DEV_USERS.find(
                (user) => user.email.toLowerCase() === email
              );
              if (!devUser) return null;
              await ensureDevUsers();
              return {
                id: email,
                name: devUser.fullName,
                email: devUser.email,
              };
            },
          }),
        ]
      : []),
  ],
  secret: process.env.AUTH_SECRET,
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "dev-credentials") {
        return process.env.NODE_ENV !== "production";
      }
      // Only allow horacemann.org emails
      return user?.email?.endsWith("@horacemann.org") || false;
    },
    async jwt({ token, user }) {
      // If Google didn't provide a name, derive from email
      if (user?.email && !user.name) {
        const local = user.email.split("@")[0] ?? "";
        token.name = local.replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      }
      return token;
    },
    async session({ session, token }) {
      if (token.name && session.user) {
        session.user.name = token.name as string;
      }
      return session;
    },
  },
  // redirect to login no matter what 
  pages: {
    signIn: "/login",
    error: "/login", 
  },
});
