export async function register() {
  // Only run on the server (not edge runtime)
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Production startup guards — fail closed rather than running with
  // a misconfigured environment.
  if (process.env.NODE_ENV === "production") {
    const appUrl = process.env.APP_URL;
    if (!appUrl) {
      throw new Error("Refusing to start: APP_URL must be set in production.");
    }
    if (!/^https:\/\//i.test(appUrl)) {
      throw new Error(
        `Refusing to start: APP_URL must use https:// in production (got ${appUrl}).`
      );
    }
    if (!process.env.AUTH_SECRET && !process.env.NEXTAUTH_SECRET) {
      throw new Error(
        "Refusing to start: AUTH_SECRET (or NEXTAUTH_SECRET) must be set in production."
      );
    }
  }

  const { initEncryption } = await import("@/src/server/encryption");
  await initEncryption();
}
