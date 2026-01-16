import LoginClient from "./login-client";

type LoginPageProps = {
  searchParams?: {
    error?: string;
  };
};

export default function LoginPage({ searchParams }: LoginPageProps) {
  return <LoginClient error={searchParams?.error ?? null} />;
}