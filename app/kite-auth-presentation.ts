import type { KiteAuthStatus, KiteSnapshot } from "./live-types";

type KiteAuthSnapshot = Pick<KiteSnapshot, "status" | "authStatus" | "authUrl" | "reauthSuggested">;

export type KiteAuthControl = "authenticated" | "partial" | "cached" | "authenticate" | "unavailable";

export type KiteAuthPresentation = {
  control: KiteAuthControl;
  showAuthAction: boolean;
};

/** Minted on click when the snapshot has no authUrl (MCP login failed on the last refresh). */
export const KITE_LOGIN_HREF = "/api/kite/login?force=1&redirect=1";

export function kiteLoginHref(authUrl?: string | null): string {
  const trimmed = authUrl?.trim();
  return trimmed || KITE_LOGIN_HREF;
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
