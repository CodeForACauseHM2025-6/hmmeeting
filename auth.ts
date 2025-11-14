// auth.ts
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

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
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      // Only allow horacemann.org emails
      return user?.email?.endsWith("@horacemann.org") || false;
    },
  },
  // redirect to login no matter what 
  pages: {
    signIn: "/login",
    error: "/login", 
  },
});
