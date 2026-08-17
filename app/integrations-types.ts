export const INTEGRATION_PIPELINE_IDS = [
  "broker",
  "research",
  "newsletters",
  "calendars",
  "reminders",
  "notes",
  "yfinance",
  "sectors",
  "podcasts",
  "health",
  "tailscale",
  "llm",
] as const;

export type IntegrationPipelineId = (typeof INTEGRATION_PIPELINE_IDS)[number];

export type IntegrationStatus =
  | "live"
  | "partial"
  | "stale"
  | "unavailable"
  | "auth_required"
  | "not_configured";

export const APPLE_PERMISSION_SOURCE_IDS = [
  "mail",
  "calendars",
  "reminders",
  "podcasts",
  "notes",
] as const;

export type ApplePermissionSourceId = (typeof APPLE_PERMISSION_SOURCE_IDS)[number];

export type ApplePermissionStatus = "connected" | "permission_required" | "denied";

export type ApplePermissionTcc =
  | "eventkit-calendars"
  | "eventkit-reminders"
  | "apple-events";

export type ApplePermissionState = {
  status: ApplePermissionStatus;
  tcc: ApplePermissionTcc;
  lastChecked: string | null;
  notes: string;
};

export type IntegrationPipelineState = {
  status: IntegrationStatus;
  lastValidated: string | null;
  connected: boolean;
  notes: string;
};

export type IntegrationsWizard = {
  kiteMcpProjectDir: string;
  newslettersMailbox: string;
  researchMailbox: string;
  reminderListNames: string[];
  healthZipFolder: string;
  tailscaleUrl: string;
  calendarNames: string;
  podcastsLibrary: string;
  pythonPath: string;
  nodePath: string;
  npmPath: string;
  yfinanceNotes: string;
};

export type DashboardAppearanceSetting = "black" | "dark" | "sepia";

export type IntegrationsLlmPublic = {
  anthropicKeyConfigured: boolean;
  openaiKeyConfigured: boolean;
  geminiKeyConfigured: boolean;
  cursorKeyConfigured: boolean;
  /** Loopback Settings prefill only. `publicIntegrationsConfig` omits these. */
  anthropicApiKey?: string;
  openaiApiKey?: string;
  geminiApiKey?: string;
  cursorApiKey?: string;
};

export type IntegrationsConfig = {
  version: 1;
  wizardComplete: boolean;
  wizard: IntegrationsWizard;
  pipelines: Record<IntegrationPipelineId, IntegrationPipelineState>;
  applePermissions: Record<ApplePermissionSourceId, ApplePermissionState>;
  appearance: DashboardAppearanceSetting;
  healthIncognito: boolean;
  /** Optional on-device summarization keys. Never log or commit. */
  llm: IntegrationsLlmPublic;
};

/** Disk shape. API responses must go through `publicIntegrationsConfig`. */
export type StoredIntegrationsConfig = IntegrationsConfig & {
  llm: IntegrationsLlmPublic & {
    anthropicApiKey?: string;
    openaiApiKey?: string;
    geminiApiKey?: string;
    cursorApiKey?: string;
  };
};

export type IntegrationVenueKind = "live" | "placeholder" | "profile";

export type IntegrationVenue = {
  name: string;
  kind: IntegrationVenueKind;
};

export const RESEARCH_HOUSES = ["Axis", "HDFC", "SBI", "ET-Prime", "Moneycontrol"] as const;

export const INTEGRATIONS_SEED_WIZARD: IntegrationsWizard = {
  kiteMcpProjectDir: "",
  newslettersMailbox: "Newsletters",
  researchMailbox: "Axis Research",
  reminderListNames: ["Job 🔍", "Earnings"],
  healthZipFolder: "",
  tailscaleUrl: "",
  calendarNames: "Apple Calendar",
  podcastsLibrary: "Apple Podcasts",
  pythonPath: "",
  nodePath: "",
  npmPath: "",
  yfinanceNotes: "yfinance (free, no API key). Used for Sectoral Analytics.",
};

export function emptyPipeline(status: IntegrationStatus, notes: string): IntegrationPipelineState {
  return { status, lastValidated: null, connected: status === "live" || status === "partial", notes };
}

export function applePermissionTcc(id: ApplePermissionSourceId): ApplePermissionTcc {
  switch (id) {
    case "calendars":
      return "eventkit-calendars";
    case "reminders":
      return "eventkit-reminders";
    case "mail":
    case "podcasts":
    case "notes":
      return "apple-events";
    default: {
      const _exhaustive: never = id;
      return _exhaustive;
    }
  }
}

export function applePermissionSeedNotes(id: ApplePermissionSourceId): string {
  switch (id) {
    case "mail":
      return "Apple Events to Mail. Only iCloud → Newsletters and iCloud → Axis Research.";
    case "calendars":
      return "EventKit full calendar access. Calendar rows are scheduling evidence, not published-results proof.";
    case "reminders":
      return "EventKit full Reminders access for Job 🔍 and Earnings. Incomplete stay actionable; completed are evidence only.";
    case "podcasts":
      return "Apple Events to Podcasts. Connect asks macOS for Automation access. Transcript label only when a local transcript exists.";
    case "notes":
      return "Optional research notes. Never a Health source — Health stays HealthKit / export / Health Shortcut.";
    default: {
      const _exhaustive: never = id;
      return _exhaustive;
    }
  }
}

export function emptyApplePermission(id: ApplePermissionSourceId): ApplePermissionState {
  return {
    status: "permission_required",
    tcc: applePermissionTcc(id),
    lastChecked: null,
    notes: applePermissionSeedNotes(id),
  };
}

export function defaultApplePermissions(): Record<ApplePermissionSourceId, ApplePermissionState> {
  return {
    mail: emptyApplePermission("mail"),
    calendars: emptyApplePermission("calendars"),
    reminders: emptyApplePermission("reminders"),
    podcasts: emptyApplePermission("podcasts"),
    notes: emptyApplePermission("notes"),
  };
}

export function applePermissionTitle(id: ApplePermissionSourceId): string {
  switch (id) {
    case "mail":
      return "Mail";
    case "calendars":
      return "Calendar";
    case "reminders":
      return "Reminders";
    case "podcasts":
      return "Podcasts";
    case "notes":
      return "Notes";
    default: {
      const _exhaustive: never = id;
      return _exhaustive;
    }
  }
}

export function isApplePermissionSourceId(value: string): value is ApplePermissionSourceId {
  switch (value) {
    case "mail":
    case "calendars":
    case "reminders":
    case "podcasts":
    case "notes":
      return true;
    default:
      return false;
  }
}

export function isApplePermissionStatus(value: string): value is ApplePermissionStatus {
  switch (value) {
    case "connected":
    case "permission_required":
    case "denied":
      return true;
    default:
      return false;
  }
}

export function isApplePermissionTcc(value: string): value is ApplePermissionTcc {
  switch (value) {
    case "eventkit-calendars":
    case "eventkit-reminders":
    case "apple-events":
      return true;
    default:
      return false;
  }
}

export function isFirstRunApplePermissionSource(id: ApplePermissionSourceId): boolean {
  switch (id) {
    case "mail":
    case "calendars":
    case "reminders":
    case "podcasts":
      return true;
    case "notes":
      return false;
    default: {
      const _exhaustive: never = id;
      return _exhaustive;
    }
  }
}

export function appleSourceForPipeline(id: IntegrationPipelineId): ApplePermissionSourceId | null {
  switch (id) {
    case "newsletters":
    case "research":
      return "mail";
    case "calendars":
      return "calendars";
    case "reminders":
      return "reminders";
    case "podcasts":
      return "podcasts";
    case "notes":
      return "notes";
    case "broker":
    case "yfinance":
    case "sectors":
    case "health":
    case "tailscale":
    case "llm":
      return null;
    default: {
      const _exhaustive: never = id;
      return _exhaustive;
    }
  }
}

export function pipelinesForAppleSource(id: ApplePermissionSourceId): IntegrationPipelineId[] {
  switch (id) {
    case "mail":
      return ["newsletters", "research"];
    case "calendars":
      return ["calendars"];
    case "reminders":
      return ["reminders"];
    case "podcasts":
      return ["podcasts"];
    case "notes":
      return ["notes"];
    default: {
      const _exhaustive: never = id;
      return _exhaustive;
    }
  }
}

export function applePrivacySettingsUrl(id: ApplePermissionSourceId): string {
  switch (id) {
    case "calendars":
      return "x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension?Privacy_Calendars";
    case "reminders":
      return "x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension?Privacy_Reminders";
    case "mail":
    case "podcasts":
    case "notes":
      return "x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension?Privacy_Automation";
    default: {
      const _exhaustive: never = id;
      return _exhaustive;
    }
  }
}

export function defaultIntegrationsConfig(): IntegrationsConfig {
  return {
    version: 1,
    wizardComplete: false,
    wizard: { ...INTEGRATIONS_SEED_WIZARD, reminderListNames: [...INTEGRATIONS_SEED_WIZARD.reminderListNames] },
    pipelines: {
      broker: emptyPipeline("auth_required", "Kite MCP BYOK. Groww is a placeholder — no live API in this slice."),
      research: emptyPipeline("not_configured", "Axis Research mailbox is the seed profile. HDFC/SBI/ET-Prime/Moneycontrol are profiles, not hardcoded houses."),
      newsletters: emptyPipeline("not_configured", "iCloud → Newsletters. Promo-strip INVARIANT."),
      calendars: emptyPipeline("not_configured", "Apple Calendar. M-3 vs M-4 split is INVARIANT."),
      reminders: emptyPipeline("not_configured", "Apple Reminders. Google Tasks is a placeholder."),
      notes: emptyPipeline("not_configured", "Research notes only. Apple Notes Health Daily is deprecated — Health is HealthKit export / Health Shortcut."),
      yfinance: emptyPipeline("live", "Free for all tiers. Paid Kite MD is never required for Sectoral Analytics."),
      sectors: emptyPipeline("not_configured", "Eleven seed sectors. S-2 filter must not leak."),
      podcasts: emptyPipeline("not_configured", "Apple Podcasts SQLite/TTML on this Mac."),
      health: emptyPipeline("not_configured", "Validate ZIP contains apple_health_export/export.xml."),
      tailscale: emptyPipeline("not_configured", "iPhone is Tailscale-only. Not a second data plane."),
      llm: emptyPipeline("not_configured", "On-device summarization only. Label output machine-drafted."),
    },
    applePermissions: defaultApplePermissions(),
    appearance: "black",
    healthIncognito: false,
    llm: { anthropicKeyConfigured: false, openaiKeyConfigured: false, geminiKeyConfigured: false, cursorKeyConfigured: false },
  };
}

export function isIntegrationPipelineId(value: string): value is IntegrationPipelineId {
  switch (value) {
    case "broker":
    case "research":
    case "newsletters":
    case "calendars":
    case "reminders":
    case "notes":
    case "yfinance":
    case "sectors":
    case "podcasts":
    case "health":
    case "tailscale":
    case "llm":
      return true;
    default:
      return false;
  }
}

export function isIntegrationStatus(value: string): value is IntegrationStatus {
  switch (value) {
    case "live":
    case "partial":
    case "stale":
    case "unavailable":
    case "auth_required":
    case "not_configured":
      return true;
    default:
      return false;
  }
}

export type RuntimeToolStatus = {
  id: string;
  label: string;
  status: "detected" | "unknown";
  path: string;
  detail: string;
};

export type IntegrationsPublicPayload = IntegrationsConfig & {
  runtime?: RuntimeToolStatus[];
};

export function pipelineTitle(id: IntegrationPipelineId): string {
  switch (id) {
    case "broker":
      return "Broker (Kite + Groww)";
    case "research":
      return "Research reports";
    case "newsletters":
      return "Newsletters mailbox";
    case "calendars":
      return "Calendars";
    case "reminders":
      return "Reminders";
    case "notes":
      return "Notes";
    case "yfinance":
      return "yfinance";
    case "sectors":
      return "Sectoral Analytics";
    case "podcasts":
      return "Podcasts";
    case "health":
      return "Apple Health export / Health Shortcut";
    case "tailscale":
      return "Tailscale";
    case "llm":
      return "Optional model keys";
    default: {
      const _exhaustive: never = id;
      return _exhaustive;
    }
  }
}

export function pipelineVenues(id: IntegrationPipelineId): IntegrationVenue[] {
  switch (id) {
    case "broker":
      return [
        { name: "Kite (Zerodha MCP BYOK)", kind: "live" },
        { name: "Groww", kind: "placeholder" },
      ];
    case "research":
      return RESEARCH_HOUSES.map((name) => ({ name, kind: "profile" as const }));
    case "newsletters":
      return [{ name: "iCloud → Newsletters", kind: "live" }];
    case "calendars":
      return [
        { name: "Apple Calendar", kind: "live" },
        { name: "Google Calendar", kind: "placeholder" },
      ];
    case "reminders":
      return [
        { name: "Apple Reminders", kind: "live" },
        { name: "Google Tasks", kind: "placeholder" },
      ];
    case "notes":
      return [
        { name: "Apple Notes", kind: "placeholder" },
        { name: "Obsidian", kind: "placeholder" },
        { name: "Notion", kind: "placeholder" },
        { name: "OneNote", kind: "placeholder" },
      ];
    case "yfinance":
      return [{ name: "yfinance (free, no key)", kind: "live" }];
    case "sectors":
      return [{ name: "Eleven seed sector snapshots", kind: "live" }];
    case "podcasts":
      return [{ name: "Apple Podcasts SQLite / TTML", kind: "live" }];
    case "health":
      return [
        { name: "Health ZIP / export.xml", kind: "live" },
        { name: "Health Shortcut", kind: "live" },
      ];
    case "tailscale":
      return [{ name: "Tailscale Serve (tailnet only)", kind: "live" }];
    case "llm":
      return [
        { name: "OpenAI", kind: "placeholder" },
        { name: "Anthropic Claude", kind: "placeholder" },
        { name: "Google Gemini", kind: "placeholder" },
        { name: "Cursor", kind: "placeholder" },
      ];
    default: {
      const _exhaustive: never = id;
      return _exhaustive;
    }
  }
}

export function publicIntegrationsConfig(config: StoredIntegrationsConfig | IntegrationsConfig): IntegrationsConfig {
  const anthropicKey = "anthropicApiKey" in config.llm ? config.llm.anthropicApiKey : undefined;
  const openaiKey = "openaiApiKey" in config.llm ? config.llm.openaiApiKey : undefined;
  const geminiKey = "geminiApiKey" in config.llm ? config.llm.geminiApiKey : undefined;
  const cursorKey = "cursorApiKey" in config.llm ? config.llm.cursorApiKey : undefined;
  return {
    version: 1,
    wizardComplete: config.wizardComplete,
    wizard: {
      ...config.wizard,
      reminderListNames: [...config.wizard.reminderListNames],
    },
    pipelines: { ...config.pipelines },
    applePermissions: { ...defaultApplePermissions(), ...config.applePermissions },
    appearance: config.appearance ?? "black",
    healthIncognito: Boolean(config.healthIncognito),
    llm: {
      anthropicKeyConfigured: Boolean(config.llm.anthropicKeyConfigured || anthropicKey),
      openaiKeyConfigured: Boolean(config.llm.openaiKeyConfigured || openaiKey),
      geminiKeyConfigured: Boolean(config.llm.geminiKeyConfigured || geminiKey),
      cursorKeyConfigured: Boolean(config.llm.cursorKeyConfigured || cursorKey),
    },
  };
}

/** Loopback Settings only. Still never a committed seed. */
export function settingsIntegrationsConfig(config: StoredIntegrationsConfig): StoredIntegrationsConfig {
  const publicConfig = publicIntegrationsConfig(config);
  return {
    ...publicConfig,
    llm: {
      ...publicConfig.llm,
      ...(config.llm.anthropicApiKey ? { anthropicApiKey: config.llm.anthropicApiKey } : {}),
      ...(config.llm.openaiApiKey ? { openaiApiKey: config.llm.openaiApiKey } : {}),
      ...(config.llm.geminiApiKey ? { geminiApiKey: config.llm.geminiApiKey } : {}),
      ...(config.llm.cursorApiKey ? { cursorApiKey: config.llm.cursorApiKey } : {}),
    },
  };
}

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function optionalSecret(value: unknown, fallback?: string): string | undefined {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed ? trimmed : fallback;
}

function mergeWizard(raw: unknown, seed: IntegrationsWizard): IntegrationsWizard {
  const record = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const lists = Array.isArray(record.reminderListNames)
    ? record.reminderListNames.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : seed.reminderListNames;
  return {
    kiteMcpProjectDir: asString(record.kiteMcpProjectDir, seed.kiteMcpProjectDir),
    newslettersMailbox: asString(record.newslettersMailbox, seed.newslettersMailbox),
    researchMailbox: asString(record.researchMailbox, seed.researchMailbox),
    reminderListNames: lists.length ? lists : [...seed.reminderListNames],
    healthZipFolder: asString(record.healthZipFolder, seed.healthZipFolder),
    tailscaleUrl: asString(record.tailscaleUrl, seed.tailscaleUrl),
    calendarNames: asString(record.calendarNames, seed.calendarNames),
    podcastsLibrary: asString(record.podcastsLibrary, seed.podcastsLibrary),
    pythonPath: asString(record.pythonPath, seed.pythonPath),
    nodePath: asString(record.nodePath, seed.nodePath),
    npmPath: asString(record.npmPath, seed.npmPath),
    yfinanceNotes: asString(record.yfinanceNotes, seed.yfinanceNotes),
  };
}

function mergePipeline(raw: unknown, seed: IntegrationPipelineState): IntegrationPipelineState {
  const record = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const status = typeof record.status === "string" && isIntegrationStatus(record.status) ? record.status : seed.status;
  return {
    status,
    lastValidated: typeof record.lastValidated === "string" || record.lastValidated === null
      ? record.lastValidated
      : seed.lastValidated,
    connected: asBoolean(record.connected, seed.connected),
    notes: asString(record.notes, seed.notes),
  };
}

function coerceApplePermissionStatus(value: unknown, fallback: ApplePermissionStatus): ApplePermissionStatus {
  if (typeof value !== "string") return fallback;
  switch (value) {
    case "connected":
    case "authorized":
    case "full_access":
    case "fullAccess":
      return "connected";
    case "denied":
    case "restricted":
      return "denied";
    case "permission_required":
    case "not_determined":
    case "notDetermined":
    case "write_only":
    case "writeOnly":
      return "permission_required";
    default:
      return isApplePermissionStatus(value) ? value : fallback;
  }
}

function mergeApplePermission(raw: unknown, seed: ApplePermissionState): ApplePermissionState {
  const record = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const tcc = typeof record.tcc === "string" && isApplePermissionTcc(record.tcc) ? record.tcc : seed.tcc;
  return {
    status: coerceApplePermissionStatus(record.status, seed.status),
    tcc,
    lastChecked: typeof record.lastChecked === "string" || record.lastChecked === null
      ? record.lastChecked
      : seed.lastChecked,
    notes: asString(record.notes, seed.notes),
  };
}

function mergeApplePermissionsMap(raw: unknown): Record<ApplePermissionSourceId, ApplePermissionState> {
  const seed = defaultApplePermissions();
  const record = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const next = { ...seed };
  for (const id of APPLE_PERMISSION_SOURCE_IDS) {
    next[id] = mergeApplePermission(record[id], seed[id]);
  }
  return next;
}

export function sanitizeStoredIntegrationsConfig(raw: unknown): StoredIntegrationsConfig {
  const seed = defaultIntegrationsConfig();
  const record = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const pipelinesRaw = record.pipelines && typeof record.pipelines === "object"
    ? record.pipelines as Record<string, unknown>
    : {};
  const pipelines = { ...seed.pipelines };
  for (const id of INTEGRATION_PIPELINE_IDS) {
    pipelines[id] = mergePipeline(pipelinesRaw[id], seed.pipelines[id]);
  }
  const applePermissions = mergeApplePermissionsMap(record.applePermissions);
  const llmRaw = record.llm && typeof record.llm === "object" ? record.llm as Record<string, unknown> : {};
  const anthropicApiKey = optionalSecret(llmRaw.anthropicApiKey);
  const openaiApiKey = optionalSecret(llmRaw.openaiApiKey);
  const geminiApiKey = optionalSecret(llmRaw.geminiApiKey);
  const cursorApiKey = optionalSecret(llmRaw.cursorApiKey);
  const appearanceRaw = typeof record.appearance === "string" ? record.appearance.trim().toLowerCase() : seed.appearance;
  const appearance: DashboardAppearanceSetting = appearanceRaw === "dark" || appearanceRaw === "sepia" || appearanceRaw === "black"
    ? appearanceRaw
    : "black";
  return {
    version: 1,
    wizardComplete: asBoolean(record.wizardComplete, false),
    wizard: mergeWizard(record.wizard, seed.wizard),
    pipelines,
    applePermissions,
    appearance,
    healthIncognito: asBoolean(record.healthIncognito, seed.healthIncognito),
    llm: {
      anthropicKeyConfigured: Boolean(asBoolean(llmRaw.anthropicKeyConfigured, false) || anthropicApiKey),
      openaiKeyConfigured: Boolean(asBoolean(llmRaw.openaiKeyConfigured, false) || openaiApiKey),
      geminiKeyConfigured: Boolean(asBoolean(llmRaw.geminiKeyConfigured, false) || geminiApiKey),
      cursorKeyConfigured: Boolean(asBoolean(llmRaw.cursorKeyConfigured, false) || cursorApiKey),
      ...(anthropicApiKey ? { anthropicApiKey } : {}),
      ...(openaiApiKey ? { openaiApiKey } : {}),
      ...(geminiApiKey ? { geminiApiKey } : {}),
      ...(cursorApiKey ? { cursorApiKey } : {}),
    },
  };
}

export function sanitizeIntegrationsConfig(raw: unknown): IntegrationsConfig {
  return publicIntegrationsConfig(sanitizeStoredIntegrationsConfig(raw));
}

export function mergeIntegrationsUpdate(
  existing: StoredIntegrationsConfig,
  body: unknown,
): StoredIntegrationsConfig {
  const record = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const llmRaw = record.llm && typeof record.llm === "object" ? record.llm as Record<string, unknown> : {};
  const clearKeys = asBoolean(record.clearLlmKeys, false);
  const nextAnthropic = clearKeys
    ? undefined
    : optionalSecret(llmRaw.anthropicApiKey, existing.llm.anthropicApiKey);
  const nextOpenai = clearKeys
    ? undefined
    : optionalSecret(llmRaw.openaiApiKey, existing.llm.openaiApiKey);
  const nextGemini = clearKeys
    ? undefined
    : optionalSecret(llmRaw.geminiApiKey, existing.llm.geminiApiKey);
  const nextCursor = clearKeys
    ? undefined
    : optionalSecret(llmRaw.cursorApiKey, existing.llm.cursorApiKey);
  const wizardRaw = record.wizard && typeof record.wizard === "object"
    ? { ...existing.wizard, ...record.wizard }
    : existing.wizard;
  return sanitizeStoredIntegrationsConfig({
    ...existing,
    ...record,
    wizard: wizardRaw,
    llm: {
      anthropicKeyConfigured: Boolean(nextAnthropic),
      openaiKeyConfigured: Boolean(nextOpenai),
      geminiKeyConfigured: Boolean(nextGemini),
      cursorKeyConfigured: Boolean(nextCursor),
      ...(nextAnthropic ? { anthropicApiKey: nextAnthropic } : {}),
      ...(nextOpenai ? { openaiApiKey: nextOpenai } : {}),
      ...(nextGemini ? { geminiApiKey: nextGemini } : {}),
      ...(nextCursor ? { cursorApiKey: nextCursor } : {}),
    },
  });
}

export function applyPipelineAction(
  config: IntegrationsConfig | StoredIntegrationsConfig,
  pipelineId: IntegrationPipelineId,
  action: "connect" | "disconnect" | "test",
): StoredIntegrationsConfig {
  const stored = sanitizeStoredIntegrationsConfig(config);
  const current = stored.pipelines[pipelineId];
  const now = new Date().toISOString();
  let next: IntegrationPipelineState;
  switch (action) {
    case "connect":
      next = {
        ...current,
        connected: true,
        status: pipelineId === "broker" ? "auth_required" : pipelineId === "yfinance" ? "live" : "partial",
        lastValidated: now,
      };
      break;
    case "disconnect":
      next = {
        ...current,
        connected: false,
        status: "not_configured",
        lastValidated: now,
      };
      break;
    case "test":
      next = {
        ...current,
        lastValidated: now,
        status: current.connected
          ? (pipelineId === "yfinance" ? "live" : "partial")
          : "not_configured",
      };
      break;
    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
  return {
    ...stored,
    pipelines: { ...stored.pipelines, [pipelineId]: next },
  };
}

export function parsePipelineAction(value: string | null | undefined): "connect" | "disconnect" | "test" | null {
  switch (value) {
    case "connect":
    case "disconnect":
    case "test":
      return value;
    default:
      return null;
  }
}

export function parseApplePermissionsAction(value: string | null | undefined): boolean {
  switch (value) {
    case "apple-permissions":
    case "permission-status":
      return true;
    default:
      return false;
  }
}

function pipelineStatusForApplePermission(status: ApplePermissionStatus): IntegrationStatus {
  switch (status) {
    case "connected":
      return "partial";
    case "denied":
      return "auth_required";
    case "permission_required":
      return "not_configured";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

export function mergeApplePermissionsUpdate(
  existing: StoredIntegrationsConfig | IntegrationsConfig,
  body: unknown,
): StoredIntegrationsConfig {
  const stored = sanitizeStoredIntegrationsConfig(existing);
  const record = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const now = new Date().toISOString();
  let nextPermissions = { ...stored.applePermissions };
  if (record.applePermissions && typeof record.applePermissions === "object") {
    nextPermissions = mergeApplePermissionsMap({ ...stored.applePermissions, ...record.applePermissions });
  }
  const source = typeof record.source === "string" && isApplePermissionSourceId(record.source) ? record.source : null;
  if (source) {
    nextPermissions = {
      ...nextPermissions,
      [source]: mergeApplePermission({
        ...nextPermissions[source],
        status: record.status,
        tcc: record.tcc,
        lastChecked: typeof record.lastChecked === "string" ? record.lastChecked : now,
        notes: record.notes,
      }, nextPermissions[source]),
    };
  }
  const pipelines = { ...stored.pipelines };
  for (const id of APPLE_PERMISSION_SOURCE_IDS) {
    const permission = nextPermissions[id];
    const previous = stored.applePermissions[id];
    if (permission.status === previous.status) continue;
    for (const pipelineId of pipelinesForAppleSource(id)) {
      const current = pipelines[pipelineId];
      pipelines[pipelineId] = {
        ...current,
        connected: permission.status === "connected",
        status: permission.status === "connected"
          ? (current.status === "live" ? "live" : pipelineStatusForApplePermission(permission.status))
          : pipelineStatusForApplePermission(permission.status),
        lastValidated: permission.lastChecked ?? current.lastValidated,
        notes: current.notes,
      };
    }
  }
  return {
    ...stored,
    applePermissions: nextPermissions,
    pipelines,
  };
}

export function assertPipelineId(value: string | null | undefined): IntegrationPipelineId | null {
  if (!value) return null;
  return isIntegrationPipelineId(value) ? value : null;
}
