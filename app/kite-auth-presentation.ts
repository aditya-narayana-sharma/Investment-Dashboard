import type { KiteAuthStatus, KiteSnapshot } from "./live-types";

type KiteAuthSnapshot = Pick<KiteSnapshot, "status" | "authStatus" | "authUrl" | "reauthSuggested">;

export type KiteAuthControl = "authenticated" | "partial" | "cached" | "authenticate" | "unavailable";

export type KiteAuthPresentation = {
  control: KiteAuthControl;
  showAuthAction: boolean;
};

/** JSON login mint. Never use redirect=1 — Flask urlopen follows 302 onto the dashboard origin. */
export const KITE_LOGIN_HREF = "/api/kite/login?force=1";

export function kiteLoginHref(authUrl?: string | null): string {
  const trimmed = authUrl?.trim();
  return trimmed || KITE_LOGIN_HREF;
}

export async function openKiteLogin(authUrl?: string | null): Promise<void> {
  const direct = authUrl?.trim();
  if (direct && !direct.includes("/api/kite/login")) {
    window.location.assign(direct);
    return;
  }
  const response = await fetch(KITE_LOGIN_HREF, { cache: "no-store", headers: { Accept: "application/json" } });
  const payload = await response.json() as { loginUrl?: string; message?: string };
  const loginUrl = payload.loginUrl?.trim();
  if (!loginUrl) {
    throw new Error(payload.message || "Could not create a Kite login URL");
  }
  window.location.assign(loginUrl);
}

function explicitAuthFailure(status: KiteSnapshot["status"], authStatus: KiteAuthStatus) {
  return status === "auth_required" || authStatus === "unauthenticated" || authStatus === "expired";
}

/**
 * Keep data completeness separate from authentication.
 *
 * A stale auth URL or historical reauth suggestion must never turn a valid,
 * partial snapshot into an authentication prompt. Only a confirmed session
 * (live / partial / cached-with-profile) suppresses the login control.
 *
 * status=unavailable ("waiting for live Kite data") still offers Authenticate
 * Kite. Hiding the control because getLoginUrl failed on the last refresh is
 * the native-app dead-end: the login route can mint a URL on click.
 */
export function kiteAuthPresentation(snapshot: KiteAuthSnapshot): KiteAuthPresentation {
  const authFailed = explicitAuthFailure(snapshot.status, snapshot.authStatus);

  if (authFailed) return { control: "authenticate", showAuthAction: true };
  if (snapshot.status === "snapshot") {
    if (snapshot.authStatus === "authenticated") return { control: "cached", showAuthAction: false };
    return { control: "authenticate", showAuthAction: true };
  }
  if (snapshot.status === "partial") return { control: "partial", showAuthAction: false };
  if (snapshot.status === "live" && snapshot.authStatus === "authenticated") {
    return { control: "authenticated", showAuthAction: false };
  }
  return { control: "authenticate", showAuthAction: true };
}
