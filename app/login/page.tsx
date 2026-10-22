import LoginClient from "./login-client";
import { DEV_USERS } from "@/src/config/devUsers";

type LoginPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const devUsers =
    process.env.NODE_ENV !== "production"
      ? DEV_USERS.map(({ email, fullName, role }) => ({ email, fullName, role }))
      : [];
  return <LoginClient error={params?.error ?? null} devUsers={devUsers} />;
}