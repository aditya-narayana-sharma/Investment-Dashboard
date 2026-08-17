/**
 * Author login is Auth0.swift Universal Login on Mac and iPhone.
 * Vinext/Cloudflare does not run Next.js middleware, so this module does not
 * instantiate `@auth0/nextjs-auth0`. Flask on :5050 mints the `stratji_author`
 * cookie after the native SDK posts tokens to `/_auth/session`.
 *
 * Fill AUTH0_* in `.env.local` (gitignored) and `artifacts/private/auth0.env`
 * for the gateway. Do not commit secrets.
 */
export const AUTH0_WEB_CALLBACKS = [
  "http://127.0.0.1:5050/_auth/callback",
  "http://127.0.0.1:3000/auth/callback",
  "http://localhost:5050/_auth/callback",
  "http://localhost:3000/auth/callback",
] as const;

export const AUTH0_WEB_LOGOUT_URLS = [
  "http://127.0.0.1:5050",
  "http://127.0.0.1:3000",
  "http://localhost:5050",
  "http://localhost:3000",
] as const;

export function isAuth0WebConfigured(): boolean {
  const domain = process.env.AUTH0_DOMAIN ?? "";
  return domain.length > 0 && !domain.startsWith("YOUR_");
}
