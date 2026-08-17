export const DEFAULT_SECTOR_IDS = [
  "pharma",
  "power",
  "infrastructure",
  "auto",
  "telecom",
  "banking",
  "nbfc",
  "fmcg",
  "consumer",
  "energy",
  "defence",
] as const;

export const RESEARCH_PROVIDER_IDS = ["axis", "hdfc", "sbi", "et-prime", "moneycontrol"] as const;

export type ResearchProviderId = (typeof RESEARCH_PROVIDER_IDS)[number];

export type MailboxRef = {
  account: string;
  mailbox: string;
};

export type ResearchProviderConfig = MailboxRef & {
  id: string;
  label: string;
  pdfDir: string;
  enabled: boolean;
};

export type IntegrationsConfig = {
  broker: { id: string; mcpUrl: string };
  newsletters: MailboxRef[];
  research: ResearchProviderConfig[];
  calendars: { earningsName: string; include: string[] };
  reminders: { lists: string[] };
  notes: {
    apple: string[];
    obsidianVault: string | null;
    notion: Record<string, unknown> | null;
    onenote: Record<string, unknown> | null;
  };
  sectors: string[];
  googleTasks: { enabled: boolean };
};

export const DEFAULT_INTEGRATIONS_CONFIG: IntegrationsConfig = {
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
  sectors: [...DEFAULT_SECTOR_IDS],
  googleTasks: { enabled: false },
};
