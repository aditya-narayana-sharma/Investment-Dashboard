import { resolveBrokerAdapter, type BrokerAdapter } from "./broker/index.ts";
import { DEFAULT_INTEGRATIONS_CONFIG, type IntegrationsConfig } from "./defaults.ts";
import { testNotesAdapter } from "./notes/index.ts";
import { RESEARCH_CATALOG, researchProviderStatus } from "./research/index.ts";

export type IntegrationSemanticStatus =
  | "live"
  | "cached"
  | "partial"
  | "unavailable"
  | "permission_required"
  | "unconfigured";

export type IntegrationCard = {
  id: string;
  pipeline: "broker" | "research" | "mail" | "calendar" | "reminders" | "notes" | "quotes" | "health" | "network" | "mcp";
  label: string;
  status: IntegrationSemanticStatus;
  connected: boolean;
  lastSuccessIst: string | null;
  requirements: string[];
  notes: string;
  testId: string;
  guideId: string;
};

export function brokerCard(config: IntegrationsConfig, lastSuccessIst: string | null = null): IntegrationCard {
  const adapter = resolveBrokerAdapter(config.broker.id);
  return {
    id: `broker:${adapter.id}`,
    pipeline: "broker",
    label: adapter.label,
    status: adapter.snapshotStatus === "live" ? "live" : adapter.snapshotStatus,
    connected: adapter.snapshotStatus === "live",
    lastSuccessIst,
    requirements: adapter.id === "kite"
      ? ["Loopback Flask gateway", "Kite Connect session (never stored in integrations.json)", "Optional Go MCP on :8080"]
      : ["Public documented retail API — not available", "Optional CSV holdings import is cached only"],
    notes: adapter.notes,
    testId: adapter.id,
    guideId: adapter.id === "kite" ? "kite-mcp" : "rejected",
  };
}

export function catalogCards(config: IntegrationsConfig, lastSuccessIst: string | null = null): IntegrationCard[] {
  const newsletter = config.newsletters[0] ?? DEFAULT_INTEGRATIONS_CONFIG.newsletters[0]!;
  const cards: IntegrationCard[] = [
    brokerCard(config, lastSuccessIst),
    {
      id: "quotes:yfinance",
      pipeline: "quotes",
      label: "yfinance (public delayed NSE)",
      status: "live",
      connected: true,
      lastSuccessIst,
      requirements: ["Outbound HTTPS to Yahoo Finance", "Never labelled live Kite"],
      notes: "Fallback quotes stay public_delayed. Kite last price wins when the symbol is held.",
      testId: "yfinance",
      guideId: "yfinance",
    },
    {
      id: "mail:newsletters",
      pipeline: "mail",
      label: `${newsletter.account} → ${newsletter.mailbox}`,
      status: "live",
      connected: true,
      lastSuccessIst,
      requirements: ["macOS Mail TCC", `Exact mailbox ${newsletter.mailbox}`],
      notes: "Newsletter digest reads only the configured mailbox. Promo and CTA copy is stripped.",
      testId: "newsletters",
      guideId: "mail-mapping",
    },
    ...RESEARCH_CATALOG.map((provider) => {
      const row = config.research.find((item) => item.id === provider.id);
      const status = researchProviderStatus(row, provider);
      return {
        id: `research:${provider.id}`,
        pipeline: "research" as const,
        label: row?.label ?? provider.label,
        status,
        connected: status === "live",
        lastSuccessIst: status === "live" ? lastSuccessIst : null,
        requirements: ["User mailbox or local PDF folder", "No paywall login scraping"],
        notes: row?.enabled === false
          ? "Disabled in integrations.json."
          : status === "unconfigured"
            ? "Add a mailbox and/or local PDF folder. Do not scrape ET Prime or Moneycontrol logins."
            : `Mailbox ${row?.account} → ${row?.mailbox}; PDFs ${row?.pdfDir}.`,
        testId: `research:${provider.id}`,
        guideId: "mail-mapping",
      };
    }),
    {
      id: "calendar:earnings",
      pipeline: "calendar",
      label: `Apple Calendar · ${config.calendars.earningsName}`,
      status: "live",
      connected: true,
      lastSuccessIst,
      requirements: ["Calendar.sqlitedb TCC"],
      notes: "Calendar rows are scheduling evidence, not proof a result was published.",
      testId: "calendar",
      guideId: "mail-mapping",
    },
    {
      id: "reminders:lists",
      pipeline: "reminders",
      label: `Reminders · ${config.reminders.lists.join(", ")}`,
      status: "live",
      connected: true,
      lastSuccessIst,
      requirements: ["Reminders TCC", "EventKit complete helper"],
      notes: "Incomplete items stay actionable. Completed items are evidence only.",
      testId: "reminders",
      guideId: "mail-mapping",
    },
    {
      id: "notes:obsidian",
      pipeline: "notes",
      label: "Obsidian vault",
      status: config.notes.obsidianVault ? "live" : "unconfigured",
      connected: Boolean(config.notes.obsidianVault),
      lastSuccessIst: config.notes.obsidianVault ? lastSuccessIst : null,
      requirements: ["Local vault path", "No path traversal"],
      notes: config.notes.obsidianVault ?? "Set notes.obsidianVault to a folder you own.",
      testId: "notes:obsidian",
      guideId: "mcp-skills-agents",
    },
    {
      id: "notes:apple",
      pipeline: "notes",
      label: "Apple Notes (user-selected titles)",
      status: config.notes.apple.length ? "live" : "unconfigured",
      connected: config.notes.apple.length > 0,
      lastSuccessIst: config.notes.apple.length ? lastSuccessIst : null,
      requirements: ["Notes TCC"],
      notes: config.notes.apple.length
        ? `Titles: ${config.notes.apple.join(", ")}`
        : "Health Daily notes stay deprecated. Add exact note titles you own.",
      testId: "notes:apple",
      guideId: "mcp-skills-agents",
    },
    {
      id: "notes:notion",
      pipeline: "notes",
      label: "Notion",
      status: config.notes.notion ? "cached" : "unconfigured",
      connected: Boolean(config.notes.notion),
      lastSuccessIst: null,
      requirements: ["On-device Notion MCP or integration token in artifacts/private"],
      notes: "Tokens never belong in git. Unconfigured stays unavailable.",
      testId: "notes:notion",
      guideId: "mcp-skills-agents",
    },
    {
      id: "notes:onenote",
      pipeline: "notes",
      label: "Microsoft OneNote",
      status: config.notes.onenote ? "cached" : "unavailable",
      connected: Boolean(config.notes.onenote),
      lastSuccessIst: null,
      requirements: ["Microsoft Graph token on-device"],
      notes: "Without a Graph token this card stays unavailable. No unofficial scraping.",
      testId: "notes:onenote",
      guideId: "mcp-skills-agents",
    },
    {
      id: "tasks:google",
      pipeline: "reminders",
      label: "Google Tasks",
      status: config.googleTasks.enabled ? "permission_required" : "unavailable",
      connected: false,
      lastSuccessIst: null,
      requirements: ["On-device OAuth", "Tokens in artifacts/private/"],
      notes: "Unconfigured equals unavailable. No cloud hosting of OAuth tokens.",
      testId: "tasks:google",
      guideId: "mcp-skills-agents",
    },
    {
      id: "network:tailscale",
      pipeline: "network",
      label: "Tailscale iPhone access",
      status: "live",
      connected: true,
      lastSuccessIst,
      requirements: ["Same tailnet on Mac and iPhone", "Flask loopback + launchd"],
      notes: "The dashboard is on-device. Tailscale is the private path, not a hosted SaaS.",
      testId: "tailscale",
      guideId: "tailscale",
    },
    {
      id: "health:healthkit",
      pipeline: "health",
      label: "HealthKit pairing",
      status: "live",
      connected: true,
      lastSuccessIst,
      requirements: ["iOS HealthKit", "Mac pairing code", "Health Shortcut export"],
      notes: "HealthKit stays iOS-only. Body Measurements and Hearing remain excluded.",
      testId: "healthkit",
      guideId: "health-pairing",
    },
  ];
  return cards;
}

export async function testIntegration(id: string, config: IntegrationsConfig): Promise<{
  id: string;
  status: IntegrationSemanticStatus;
  message: string;
}> {
  const broker = resolveBrokerAdapter(config.broker.id);
  if (id === broker.id || id === "kite" || id === "broker") {
    if (broker.snapshotStatus !== "live") {
      return { id, status: "unavailable", message: broker.notes };
    }
    return { id, status: "live", message: "Kite adapter is selected. Tokens stay in the Kite session store, not integrations.json." };
  }
  if (id === "grow" || id === "groww") {
    return { id, status: "unavailable", message: "Grow has no public retail API. CSV import is cached only." };
  }
  if (id === "yfinance") {
    return { id, status: "live", message: "yfinance remains the public_delayed NSE fallback." };
  }
  if (id === "newsletters") {
    const mailbox = config.newsletters[0];
    return { id, status: mailbox ? "live" : "unavailable", message: mailbox ? `Mapped to ${mailbox.account} → ${mailbox.mailbox}.` : "No newsletter mailbox configured." };
  }
  if (id === "calendar") {
    return { id, status: "live", message: `Earnings calendar name is ${config.calendars.earningsName}.` };
  }
  if (id === "reminders") {
    return { id, status: "live", message: `Priority lists: ${config.reminders.lists.join(", ")}.` };
  }
  if (id === "tailscale") {
    return { id, status: "live", message: "Use the same tailnet. Flask stays loopback-only." };
  }
  if (id === "healthkit") {
    return { id, status: "live", message: "HealthKit is iOS-only. Pair from the native iPhone Settings sheet." };
  }
  if (id.startsWith("research:")) {
    const providerId = id.slice("research:".length);
    const row = config.research.find((item) => item.id === providerId);
    const catalog = RESEARCH_CATALOG.find((item) => item.id === providerId);
    const status = researchProviderStatus(row, catalog);
    return {
      id,
      status,
      message: status === "live"
        ? `${row?.label} mailbox ${row?.account} → ${row?.mailbox}.`
        : status === "unconfigured"
          ? "Configure a mailbox and local PDF folder. Paywall scraping is rejected."
          : "Provider disabled or unavailable.",
    };
  }
  if (id.startsWith("notes:") || id.startsWith("tasks:")) {
    return testNotesAdapter(id, config);
  }
  return { id, status: "unavailable", message: `Unknown integration ${id}.` };
}

export function publicBroker(adapter: BrokerAdapter) {
  return {
    id: adapter.id,
    label: adapter.label,
    capabilities: adapter.capabilities,
    snapshotStatus: adapter.snapshotStatus,
    orderPath: adapter.orderPath,
    gttPath: adapter.gttPath,
    alertPath: adapter.alertPath,
    instrumentsPath: adapter.instrumentsPath,
    notes: adapter.notes,
  };
}
