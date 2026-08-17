export const LICENSE_TIERS = ["basic", "pro", "ultra"] as const;
export type LicenseTier = (typeof LICENSE_TIERS)[number];

export const LICENSE_FEATURES = [
  "investment",
  "sectors",
  "sectorsS3",
  "intelligence",
  "health",
  "pdf",
  "builder",
  "strategies",
  "streak",
  "integrations",
] as const;
export type LicenseFeature = (typeof LICENSE_FEATURES)[number];

export type LicenseSource = "key" | "operator" | "env" | "default" | "author";

export type PublicLicense = {
  tier: LicenseTier;
  keyPresent: boolean;
  source: LicenseSource;
  updatedAt: string | null;
  message: string;
  author: boolean;
  operatorTier: LicenseTier | null;
  /** Present for the author Mac so Settings can show the master key. Never a cloud secret. */
  key: string | null;
};

export type StoredLicense = {
  version: 1;
  tier: LicenseTier;
  key: string;
  operatorOverride: boolean;
  /** Operator of this clone — unlocks Ultra on this Mac only. */
  author: boolean;
  operatorTier: LicenseTier | null;
  updatedAt: string;
};

export const TIER_LABELS: Record<LicenseTier, string> = {
  basic: "Basic",
  pro: "Pro",
  ultra: "Ultra",
};

export const TIER_INCLUDES: Record<LicenseTier, string[]> = {
  basic: [
    "Portfolio Overview (I-1–I-4)",
    "Sectoral Analytics S-1 and S-2 (yfinance)",
    "Integrations / Settings wizard",
  ],
  pro: [
    "Everything in Basic",
    "Market Intelligence M-1–M-4",
    "Health & Wellness H-1–H-3",
    "S-3 Benchmarks & Decision Lab",
    "Investment Brief PDF export",
  ],
  ultra: [
    "Everything in Pro",
    "Algorithm Canvas",
    "Strategies library",
    "Streak export checklist",
  ],
};

export const FEATURE_REQUIRED_TIER: Record<LicenseFeature, LicenseTier> = {
  investment: "basic",
  sectors: "basic",
  integrations: "basic",
  sectorsS3: "pro",
  intelligence: "pro",
  health: "pro",
  pdf: "pro",
  builder: "ultra",
  strategies: "ultra",
  streak: "ultra",
};

export function isLicenseTier(value: string): value is LicenseTier {
  switch (value) {
    case "basic":
    case "pro":
    case "ultra":
      return true;
    default:
      return false;
  }
}

export function isLicenseFeature(value: string): value is LicenseFeature {
  switch (value) {
    case "investment":
    case "sectors":
    case "sectorsS3":
    case "intelligence":
    case "health":
    case "pdf":
    case "builder":
    case "strategies":
    case "streak":
    case "integrations":
      return true;
    default:
      return false;
  }
}

export function isLicenseSource(value: unknown): value is LicenseSource {
  switch (value) {
    case "key":
    case "operator":
    case "env":
    case "default":
    case "author":
      return true;
    default:
      return false;
  }
}

export function coercePublicLicense(value: unknown): PublicLicense | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.tier !== "string" || !isLicenseTier(record.tier)) return null;
  const operatorTierRaw = typeof record.operatorTier === "string" ? record.operatorTier.trim().toLowerCase() : "";
  return {
    tier: record.tier,
    keyPresent: record.keyPresent === true,
    source: isLicenseSource(record.source) ? record.source : "default",
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : null,
    message: typeof record.message === "string" ? record.message : "",
    author: record.author === true,
    operatorTier: isLicenseTier(operatorTierRaw) ? operatorTierRaw : null,
    key: typeof record.key === "string" && record.key.trim() ? record.key.trim() : null,
  };
}

/** True when this snapshot came from a key, author Mac, env, or operator — not the Basic placeholder. */
export function isResolvedLicense(license: PublicLicense | null | undefined): boolean {
  if (!license || !isLicenseTier(license.tier)) return false;
  switch (license.source) {
    case "key":
    case "operator":
    case "env":
    case "author":
      return true;
    case "default":
      return license.author === true || license.keyPresent === true;
    default: {
      const _exhaustive: never = license.source;
      return _exhaustive;
    }
  }
}

/**
 * Apply a later /api/license payload without flashing Basic over a server-provided
 * Ultra/Pro snapshot (author master key, env, or a key already on this Mac).
 */
export function mergeFetchedLicense(current: PublicLicense, fetched: PublicLicense | null | undefined): PublicLicense {
  if (!fetched || !isLicenseTier(fetched.tier)) return current;
  if (isResolvedLicense(current) && fetched.source === "default") return current;
  if (isResolvedLicense(current) && compareLicenseTiers(fetched.tier, current.tier) < 0) return current;
  return fetched;
}

export function defaultPublicLicense(): PublicLicense {
  return {
    tier: "basic",
    keyPresent: false,
    source: "default",
    updatedAt: null,
    message: "No license key on this Mac. Basic is active until you paste a key or set a tier in Settings.",
    author: false,
    operatorTier: null,
    key: null,
  };
}

/** Author / publisher master keys: `stratji-ultra-master-<token>`. Token must be at least 4 characters. */
export function isMasterLicenseKey(raw: string): boolean {
  const key = raw.trim();
  const match = /^(?:stratji[-_])ultra[-_]master[-_](.+)$/i.exec(key);
  if (!match) return false;
  return (match[1] ?? "").trim().length >= 4;
}

/** v1 honor-system keys: `stratji-pro-<token>` / `stratji_ultra_<token>` / `stratji-ultra-master-<token>`. Token must be at least 4 characters. */
export function parseLicenseKey(raw: string): LicenseTier | null {
  const key = raw.trim();
  if (isMasterLicenseKey(key)) return "ultra";
  const match = /^(?:stratji[-_])(basic|pro|ultra)[-_](.+)$/i.exec(key);
  if (!match) return null;
  const token = (match[2] ?? "").trim();
  if (token.length < 4) return null;
  const tier = match[1]!.toLowerCase();
  return isLicenseTier(tier) ? tier : null;
}

export function compareLicenseTiers(a: LicenseTier, b: LicenseTier): number {
  const rank = (tier: LicenseTier): number => {
    switch (tier) {
      case "basic":
        return 0;
      case "pro":
        return 1;
      case "ultra":
        return 2;
      default: {
        const _exhaustive: never = tier;
        return _exhaustive;
      }
    }
  };
  return rank(a) - rank(b);
}

export function tierAllows(tier: LicenseTier, feature: LicenseFeature): boolean {
  return compareLicenseTiers(tier, FEATURE_REQUIRED_TIER[feature]) >= 0;
}

export function featureForWorkspace(workspace: "investment" | "sectors" | "intelligence" | "health" | "builder" | "strategies"): LicenseFeature {
  switch (workspace) {
    case "investment":
      return "investment";
    case "sectors":
      return "sectors";
    case "intelligence":
      return "intelligence";
    case "health":
      return "health";
    case "builder":
      return "builder";
    case "strategies":
      return "strategies";
    default: {
      const _exhaustive: never = workspace;
      return _exhaustive;
    }
  }
}

export function upgradeTarget(feature: LicenseFeature): LicenseTier {
  return FEATURE_REQUIRED_TIER[feature];
}

export function resolvePublicLicense(
  stored: StoredLicense,
  env: Record<string, string | undefined> = {},
  masterKey = "",
): PublicLicense {
  const envKey = (env.STRATJI_LICENSE_KEY ?? "").trim();
  const envTierRaw = (env.STRATJI_LICENSE_TIER ?? "").trim().toLowerCase();
  const envTier = isLicenseTier(envTierRaw) ? envTierRaw : null;
  const fileKeyTier = parseLicenseKey(stored.key);
  const envKeyTier = parseLicenseKey(envKey);
  const operatorTier = stored.operatorTier ?? (stored.operatorOverride ? stored.tier : null);
  const master = masterKey.trim();
  const authorMac = stored.author === true || isMasterLicenseKey(stored.key) || master.length > 0;

  if (authorMac) {
    const key = stored.key || master || null;
    return {
      tier: "ultra",
      keyPresent: Boolean(key),
      source: "author",
      updatedAt: stored.updatedAt || null,
      message: "Author Mac — Ultra is unlocked from the local master license file. GitHub clones stay Basic until they paste a paid key.",
      author: true,
      operatorTier: stored.operatorOverride ? stored.tier : "ultra",
      key,
    };
  }
  if (fileKeyTier) {
    return {
      tier: fileKeyTier,
      keyPresent: true,
      source: "key",
      updatedAt: stored.updatedAt || null,
      message: `Unlocked ${fileKeyTier} from a license key on this Mac.`,
      author: false,
      operatorTier,
      key: null,
    };
  }
  if (envKeyTier) {
    return {
      tier: envKeyTier,
      keyPresent: true,
      source: "env",
      updatedAt: stored.updatedAt || null,
      message: `Unlocked ${envKeyTier} from STRATJI_LICENSE_KEY.`,
      author: false,
      operatorTier,
      key: null,
    };
  }
  if (stored.operatorOverride) {
    return {
      tier: stored.tier,
      keyPresent: stored.key.length > 0,
      source: "operator",
      updatedAt: stored.updatedAt || null,
      message: `Operator set ${stored.tier} in Settings. v1 is an honor + key file, not a billing server.`,
      author: false,
      operatorTier: stored.tier,
      key: stored.key || null,
    };
  }
  if (envTier) {
    return {
      tier: envTier,
      keyPresent: false,
      source: "env",
      updatedAt: stored.updatedAt || null,
      message: `Unlocked ${envTier} from STRATJI_LICENSE_TIER.`,
      author: false,
      operatorTier,
      key: null,
    };
  }
  return defaultPublicLicense();
}
