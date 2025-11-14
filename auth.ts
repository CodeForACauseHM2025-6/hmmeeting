// auth.ts
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      // Only allow horacemann.org emails
      return user?.email?.endsWith("@horacemann.org") || false;
    },
  },
  // redirect 
  pages: {
    signIn: "/login",
    error: "/login", 
  },
});
