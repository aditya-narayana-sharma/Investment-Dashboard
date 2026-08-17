import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

export const DEFAULT_INTEGRATIONS_CONFIG = {
  broker: { id: "kite", mcpUrl: "http://127.0.0.1:8080/mcp" },
  newsletters: [{ account: "iCloud", mailbox: "Newsletters" }],
  research: [{
    id: "axis",
    label: "Axis Research",
    account: "iCloud",
    mailbox: "Axis Research",
    pdfDir: "~/Downloads/Axis Research",
    enabled: true,
  }],
  calendars: { earningsName: "Earnings", include: ["*"] },
  reminders: { lists: ["Job 🔍", "Earnings"] },
  notes: { apple: [], obsidianVault: null, notion: null, onenote: null },
  sectors: ["pharma", "power", "infrastructure", "auto", "telecom", "banking", "nbfc", "fmcg", "consumer", "energy", "defence"],
  googleTasks: { enabled: false },
};

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function asString(value, fallback) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function asMailbox(row, fallback) {
  if (!row || typeof row !== "object") return fallback;
  return {
    account: asString(row.account, fallback.account),
    mailbox: asString(row.mailbox, fallback.mailbox),
  };
}

function asResearch(row) {
  const fallback = DEFAULT_INTEGRATIONS_CONFIG.research[0];
  if (!row || typeof row !== "object") return { ...fallback };
  return {
    id: asString(row.id, fallback.id),
    label: asString(row.label, fallback.label),
    account: asString(row.account, fallback.account),
    mailbox: asString(row.mailbox, fallback.mailbox),
    pdfDir: asString(row.pdfDir, fallback.pdfDir),
    enabled: row.enabled !== false,
  };
}

export function normalizeIntegrationsConfig(raw) {
  const input = raw && typeof raw === "object" ? raw : {};
  const newsletters = Array.isArray(input.newsletters) && input.newsletters.length
    ? input.newsletters.map((row, index) => asMailbox(row, DEFAULT_INTEGRATIONS_CONFIG.newsletters[index] ?? DEFAULT_INTEGRATIONS_CONFIG.newsletters[0]))
    : DEFAULT_INTEGRATIONS_CONFIG.newsletters.map((row) => ({ ...row }));
  const research = Array.isArray(input.research) && input.research.length
    ? input.research.map(asResearch)
    : DEFAULT_INTEGRATIONS_CONFIG.research.map((row) => ({ ...row }));
  const lists = Array.isArray(input.reminders?.lists) && input.reminders.lists.length
    ? input.reminders.lists.map((item) => asString(item, "")).filter(Boolean)
    : [...DEFAULT_INTEGRATIONS_CONFIG.reminders.lists];
  const sectors = Array.isArray(input.sectors) && input.sectors.length
    ? input.sectors.map((item) => asString(item, "")).filter(Boolean)
    : [...DEFAULT_INTEGRATIONS_CONFIG.sectors];
  return {
    broker: {
      id: asString(input.broker?.id, DEFAULT_INTEGRATIONS_CONFIG.broker.id),
      mcpUrl: asString(input.broker?.mcpUrl, DEFAULT_INTEGRATIONS_CONFIG.broker.mcpUrl),
    },
    newsletters,
    research,
    calendars: {
      earningsName: asString(input.calendars?.earningsName, DEFAULT_INTEGRATIONS_CONFIG.calendars.earningsName),
      include: Array.isArray(input.calendars?.include) && input.calendars.include.length
        ? input.calendars.include.map((item) => asString(item, "*"))
        : ["*"],
    },
    reminders: { lists },
    notes: {
      apple: Array.isArray(input.notes?.apple) ? input.notes.apple.map((item) => asString(item, "")).filter(Boolean) : [],
      obsidianVault: typeof input.notes?.obsidianVault === "string" && input.notes.obsidianVault.trim()
        ? input.notes.obsidianVault.trim()
        : null,
      notion: input.notes?.notion && typeof input.notes.notion === "object" ? input.notes.notion : null,
      onenote: input.notes?.onenote && typeof input.notes.onenote === "object" ? input.notes.onenote : null,
    },
    sectors,
    googleTasks: { enabled: input.googleTasks?.enabled === true },
  };
}

export function integrationsConfigPaths() {
  return [
    process.env.INTEGRATIONS_CONFIG_PATH,
    join(ROOT, "artifacts/private/integrations.json"),
    join(ROOT, "config/integrations.example.json"),
  ].filter(Boolean);
}

export function loadIntegrationsConfig() {
  for (const path of integrationsConfigPaths()) {
    if (!existsSync(path)) continue;
    const parsed = readJson(path);
    if (parsed) return normalizeIntegrationsConfig(parsed);
  }
  return normalizeIntegrationsConfig(DEFAULT_INTEGRATIONS_CONFIG);
}

export function mailSourceSelectors(config = loadIntegrationsConfig()) {
  const newsletter = config.newsletters[0] ?? DEFAULT_INTEGRATIONS_CONFIG.newsletters[0];
  const axis = config.research.find((row) => row.id === "axis") ?? config.research[0] ?? DEFAULT_INTEGRATIONS_CONFIG.research[0];
  return {
    newsletterAccount: newsletter.account,
    newsletterMailbox: newsletter.mailbox,
    axisAccount: axis.account,
    axisMailbox: axis.mailbox,
    axisPdfDir: axis.pdfDir,
    reminderLists: [...config.reminders.lists],
    earningsCalendarName: config.calendars.earningsName,
    sectors: [...config.sectors],
  };
}

export function expandUserPath(path) {
  if (typeof path !== "string") return path;
  if (path.startsWith("~/")) return join(process.env.HOME ?? "", path.slice(2));
  return path;
}
