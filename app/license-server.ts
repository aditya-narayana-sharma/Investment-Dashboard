import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import {
  defaultPublicLicense,
  isLicenseTier,
  isMasterLicenseKey,
  parseLicenseKey,
  resolvePublicLicense,
  type LicenseTier,
  type PublicLicense,
  type StoredLicense,
} from "./license";

export type { StoredLicense };

export type LicenseUpdate = {
  key?: string;
  tier?: string;
  operatorOverride?: boolean;
  author?: boolean;
  operatorTier?: string;
  clearKey?: boolean;
};

function supportLicensePath(): string {
  return path.join(homedir(), "Library", "Application Support", "Stratji", "license.json");
}

function repoLicensePath(root = process.cwd()): string {
  return path.join(root, "artifacts", "private", "license.json");
}

function repoMasterKeyPath(root = process.cwd()): string {
  return path.join(root, "artifacts", "private", "license-master.txt");
}

function emptyStored(): StoredLicense {
  return {
    version: 1,
    tier: "basic",
    key: "",
    operatorOverride: false,
    author: false,
    operatorTier: null,
    updatedAt: "",
  };
}

function sanitizeStored(value: unknown): StoredLicense {
  const record = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const tierRaw = typeof record.tier === "string" ? record.tier.trim().toLowerCase() : "basic";
  const operatorTierRaw = typeof record.operatorTier === "string" ? record.operatorTier.trim().toLowerCase() : "";
  return {
    version: 1,
    tier: isLicenseTier(tierRaw) ? tierRaw : "basic",
    key: typeof record.key === "string" ? record.key.trim() : "",
    operatorOverride: record.operatorOverride === true,
    author: record.author === true,
    operatorTier: isLicenseTier(operatorTierRaw) ? operatorTierRaw : null,
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : "",
  };
}

async function readJsonFile(filePath: string): Promise<StoredLicense | null> {
  try {
    const text = await readFile(filePath, "utf8");
    return sanitizeStored(JSON.parse(text) as unknown);
  } catch {
    return null;
  }
}

export function supportLicenseFilePath(): string {
  return supportLicensePath();
}

/** Live master key lives only in gitignored `artifacts/private/`. Empty on GitHub clones. */
export async function readMasterLicenseKey(root = process.cwd()): Promise<string> {
  try {
    const fromTxt = (await readFile(repoMasterKeyPath(root), "utf8")).trim();
    if (fromTxt) return fromTxt;
  } catch {
    /* no master file on this Mac */
  }
  try {
    const fromJson = await readJsonFile(repoLicensePath(root));
    if (fromJson && (fromJson.author || isMasterLicenseKey(fromJson.key)) && fromJson.key) {
      return fromJson.key;
    }
  } catch {
    /* ignore */
  }
  return "";
}

export type PublicLicenseReadOptions = {
  /** Override ~/Library/Application Support/Stratji/license.json. Use a missing path to simulate a GitHub clone. */
  supportFilePath?: string;
  env?: Record<string, string | undefined>;
};

export async function readStoredLicense(root = process.cwd(), supportFilePath = supportLicensePath()): Promise<StoredLicense> {
  const fromSupport = await readJsonFile(supportFilePath);
  if (fromSupport) return fromSupport;
  const fromRepo = await readJsonFile(repoLicensePath(root));
  if (fromRepo) return fromRepo;
  return emptyStored();
}

export async function readPublicLicense(root = process.cwd(), options?: PublicLicenseReadOptions): Promise<PublicLicense> {
  const master = await readMasterLicenseKey(root);
  const stored = await readStoredLicense(root, options?.supportFilePath ?? supportLicensePath());
  return resolvePublicLicense(stored, options?.env ?? process.env, master);
}

/** Same files as `/api/license`. Used at dashboard SSR so first paint is Ultra on the author Mac. */
export async function readDashboardLicense(): Promise<PublicLicense> {
  try {
    return await readPublicLicense();
  } catch {
    return defaultPublicLicense();
  }
}

export async function writeStoredLicense(next: StoredLicense, root = process.cwd()): Promise<StoredLicense> {
  const sanitized = sanitizeStored(next);
  const payload = `${JSON.stringify(sanitized, null, 2)}\n`;
  const paths = [supportLicensePath(), repoLicensePath(root)];
  for (const filePath of paths) {
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, payload, { encoding: "utf8", mode: 0o600 });
  }
  return sanitized;
}

export async function applyLicenseUpdate(body: LicenseUpdate, root = process.cwd()): Promise<PublicLicense> {
  const current = await readStoredLicense(root);
  const master = await readMasterLicenseKey(root);
  let key = current.key;
  if (body.clearKey) key = "";
  if (typeof body.key === "string") key = body.key.trim();

  const keyTier = parseLicenseKey(key);
  const keyIsMaster = Boolean(key) && (isMasterLicenseKey(key) || (master.length > 0 && key === master));
  let operatorOverride = current.operatorOverride;
  let author = current.author || Boolean(master) || keyIsMaster;
  let tier: LicenseTier = current.tier;
  let operatorTier = current.operatorTier;

  if (typeof body.author === "boolean") {
    author = body.author;
  }
  if (typeof body.operatorOverride === "boolean") {
    operatorOverride = body.operatorOverride;
  }
  if (typeof body.tier === "string" && isLicenseTier(body.tier.trim().toLowerCase())) {
    tier = body.tier.trim().toLowerCase() as LicenseTier;
    operatorOverride = true;
    operatorTier = tier;
  }
  if (typeof body.operatorTier === "string" && isLicenseTier(body.operatorTier.trim().toLowerCase())) {
    operatorTier = body.operatorTier.trim().toLowerCase() as LicenseTier;
    tier = operatorTier;
    operatorOverride = true;
  }
  if (keyIsMaster || author) {
    author = true;
    tier = "ultra";
    if (!operatorOverride) operatorTier = "ultra";
    if (!key && master) key = master;
  } else if (keyTier) {
    tier = keyTier;
    operatorOverride = false;
    author = false;
  } else if (key && !body.clearKey && typeof body.key === "string") {
    throw new Error("License key must look like stratji-pro-xxxx, stratji-ultra-xxxx, or the local master key (token at least 4 characters).");
  }

  const saved = await writeStoredLicense({
    version: 1,
    tier,
    key,
    operatorOverride,
    author,
    operatorTier,
    updatedAt: new Date().toISOString(),
  }, root);
  return resolvePublicLicense(saved, process.env, master);
}
