import type { KiteAuthStatus, KiteSnapshot } from "./live-types";

type KiteAuthSnapshot = Pick<KiteSnapshot, "status" | "authStatus" | "authUrl" | "reauthSuggested">;

export type KiteAuthControl = "authenticated" | "partial" | "cached" | "authenticate" | "unavailable";

export type KiteAuthPresentation = {
  control: KiteAuthControl;
  showAuthAction: boolean;
};

function explicitAuthFailure(status: KiteSnapshot["status"], authStatus: KiteAuthStatus) {
  return status === "auth_required" || authStatus === "unauthenticated" || authStatus === "expired";
}

/**
 * Keep data completeness separate from authentication.
 *
 * A stale auth URL or historical reauth suggestion must never turn a valid,
 * partial snapshot into an authentication prompt. Only explicit token/session
 * evidence can offer the login action.
 */
export function kiteAuthPresentation(snapshot: KiteAuthSnapshot): KiteAuthPresentation {
  const authFailed = explicitAuthFailure(snapshot.status, snapshot.authStatus);

  if (authFailed) return { control: "authenticate", showAuthAction: true };
  if (snapshot.status === "snapshot") return { control: "cached", showAuthAction: false };
  if (snapshot.status === "partial") return { control: "partial", showAuthAction: false };
  if (snapshot.status === "live" && snapshot.authStatus === "authenticated") {
    return { control: "authenticated", showAuthAction: false };
  }
  return { control: "unavailable", showAuthAction: false };
}
