import { z } from "zod";
import {
  DEFAULT_INTEGRATIONS_CONFIG,
  type IntegrationsConfig,
  type MailboxRef,
  type ResearchProviderConfig,
} from "./defaults.ts";

const mailboxSchema = z.object({
  account: z.string().trim().min(1),
  mailbox: z.string().trim().min(1),
});

const researchSchema = mailboxSchema.extend({
  id: z.string().trim().min(1),
  label: z.string().trim().min(1),
  pdfDir: z.string().trim().default(""),
  enabled: z.boolean().default(true),
});

export const integrationsConfigSchema = z.object({
  broker: z.object({
    id: z.string().trim().min(1).default(DEFAULT_INTEGRATIONS_CONFIG.broker.id),
    mcpUrl: z.string().trim().default(DEFAULT_INTEGRATIONS_CONFIG.broker.mcpUrl),
  }).default(DEFAULT_INTEGRATIONS_CONFIG.broker),
  newsletters: z.array(mailboxSchema).min(1).default(DEFAULT_INTEGRATIONS_CONFIG.newsletters),
  research: z.array(researchSchema).min(1).default(DEFAULT_INTEGRATIONS_CONFIG.research),
  calendars: z.object({
    earningsName: z.string().trim().min(1).default(DEFAULT_INTEGRATIONS_CONFIG.calendars.earningsName),
    include: z.array(z.string().trim().min(1)).min(1).default(["*"]),
  }).default(DEFAULT_INTEGRATIONS_CONFIG.calendars),
  reminders: z.object({
    lists: z.array(z.string().trim().min(1)).min(1).default(DEFAULT_INTEGRATIONS_CONFIG.reminders.lists),
  }).default(DEFAULT_INTEGRATIONS_CONFIG.reminders),
  notes: z.object({
    apple: z.array(z.string().trim().min(1)).default([]),
    obsidianVault: z.string().trim().min(1).nullable().default(null),
    notion: z.record(z.string(), z.unknown()).nullable().default(null),
    onenote: z.record(z.string(), z.unknown()).nullable().default(null),
  }).default(DEFAULT_INTEGRATIONS_CONFIG.notes),
  sectors: z.array(z.string().trim().min(1)).min(1).default(DEFAULT_INTEGRATIONS_CONFIG.sectors),
  googleTasks: z.object({
    enabled: z.boolean().default(false),
  }).default(DEFAULT_INTEGRATIONS_CONFIG.googleTasks),
});

export type ParsedIntegrationsConfig = z.infer<typeof integrationsConfigSchema>;

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function asMailbox(row: unknown, fallback: MailboxRef): MailboxRef {
  if (!row || typeof row !== "object") return { ...fallback };
  const record = row as Record<string, unknown>;
  return {
    account: asString(record.account, fallback.account),
    mailbox: asString(record.mailbox, fallback.mailbox),
  };
}

function asResearch(row: unknown): ResearchProviderConfig {
  const fallback = DEFAULT_INTEGRATIONS_CONFIG.research[0]!;
  if (!row || typeof row !== "object") return { ...fallback };
  const record = row as Record<string, unknown>;
  return {
    id: asString(record.id, fallback.id),
    label: asString(record.label, fallback.label),
    account: asString(record.account, fallback.account),
    mailbox: asString(record.mailbox, fallback.mailbox),
    pdfDir: asString(record.pdfDir, fallback.pdfDir),
    enabled: record.enabled !== false,
  };
}

/** Merge unknown JSON onto today's hardcoded defaults, then validate with zod. */
export function parseIntegrationsConfig(raw: unknown): IntegrationsConfig {
  const input = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const broker = input.broker && typeof input.broker === "object" ? input.broker as Record<string, unknown> : {};
  const calendars = input.calendars && typeof input.calendars === "object" ? input.calendars as Record<string, unknown> : {};
  const reminders = input.reminders && typeof input.reminders === "object" ? input.reminders as Record<string, unknown> : {};
  const notes = input.notes && typeof input.notes === "object" ? input.notes as Record<string, unknown> : {};
  const googleTasks = input.googleTasks && typeof input.googleTasks === "object" ? input.googleTasks as Record<string, unknown> : {};
  const newsletters = Array.isArray(input.newsletters) && input.newsletters.length
    ? input.newsletters.map((row, index) => asMailbox(row, DEFAULT_INTEGRATIONS_CONFIG.newsletters[index] ?? DEFAULT_INTEGRATIONS_CONFIG.newsletters[0]!))
    : DEFAULT_INTEGRATIONS_CONFIG.newsletters.map((row) => ({ ...row }));
  const research = Array.isArray(input.research) && input.research.length
    ? input.research.map(asResearch)
    : DEFAULT_INTEGRATIONS_CONFIG.research.map((row) => ({ ...row }));
  const lists = Array.isArray(reminders.lists) && reminders.lists.length
    ? reminders.lists.map((item) => asString(item, "")).filter(Boolean)
    : [...DEFAULT_INTEGRATIONS_CONFIG.reminders.lists];
  const sectors = Array.isArray(input.sectors) && input.sectors.length
    ? input.sectors.map((item) => asString(item, "")).filter(Boolean)
    : [...DEFAULT_INTEGRATIONS_CONFIG.sectors];
  const merged: IntegrationsConfig = {
    broker: {
      id: asString(broker.id, DEFAULT_INTEGRATIONS_CONFIG.broker.id),
      mcpUrl: asString(broker.mcpUrl, DEFAULT_INTEGRATIONS_CONFIG.broker.mcpUrl),
    },
    newsletters,
    research,
    calendars: {
      earningsName: asString(calendars.earningsName, DEFAULT_INTEGRATIONS_CONFIG.calendars.earningsName),
      include: Array.isArray(calendars.include) && calendars.include.length
        ? calendars.include.map((item) => asString(item, "*")).filter(Boolean)
        : ["*"],
    },
    reminders: { lists },
    notes: {
      apple: Array.isArray(notes.apple) ? notes.apple.map((item) => asString(item, "")).filter(Boolean) : [],
      obsidianVault: typeof notes.obsidianVault === "string" && notes.obsidianVault.trim() ? notes.obsidianVault.trim() : null,
      notion: notes.notion && typeof notes.notion === "object" ? notes.notion as Record<string, unknown> : null,
      onenote: notes.onenote && typeof notes.onenote === "object" ? notes.onenote as Record<string, unknown> : null,
    },
    sectors,
    googleTasks: { enabled: googleTasks.enabled === true },
  };
  return integrationsConfigSchema.parse(merged);
}
