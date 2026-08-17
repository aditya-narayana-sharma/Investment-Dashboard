"use client";

import { useCallback, useEffect, useState } from "react";
import { Cable, Plug, RefreshCw } from "lucide-react";
import type { IntegrationsConfig } from "../integrations/defaults";
import type { IntegrationCard, IntegrationSemanticStatus } from "../integrations/registry";

type GuidePayload = { id: string; title: string; body: string };
type IntegrationsPayload = {
  status: string;
  asOf: string;
  config: IntegrationsConfig;
  cards: IntegrationCard[];
  guides: string[];
  csvHoldings?: { status?: string; rows?: unknown[]; message?: string } | null;
};

const GUIDE_LABELS: Record<string, string> = {
  "kite-mcp": "Kite MCP",
  yfinance: "yfinance",
  "mail-mapping": "Mail mapping",
  tailscale: "Tailscale",
  "health-pairing": "Health pairing",
  "mcp-skills-agents": "MCP / skills / agents",
  rejected: "Rejected",
};

function statusTone(status: IntegrationSemanticStatus | string) {
  switch (status) {
    case "live":
      return "live";
    case "cached":
    case "partial":
      return "cached";
    default:
      return "unavailable";
  }
}

export function IntegrationsWorkspace() {
  const [payload, setPayload] = useState<IntegrationsPayload | null>(null);
  const [error, setError] = useState("");
  const [guideId, setGuideId] = useState("kite-mcp");
  const [guide, setGuide] = useState<GuidePayload | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [testNote, setTestNote] = useState("");
  const [csvText, setCsvText] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/integrations", { cache: "no-store" });
    const body = await response.json() as IntegrationsPayload & { message?: string };
    if (!response.ok) throw new Error(body.message || `Integrations returned ${response.status}`);
    setPayload(body);
  }, []);

  const loadGuide = useCallback(async (id: string) => {
    const response = await fetch(`/api/integrations/guides/${id}`, { cache: "no-store" });
    const body = await response.json() as GuidePayload & { message?: string };
    if (!response.ok) throw new Error(body.message || "Guide missing");
    setGuide(body);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load().catch((reason) => setError(reason instanceof Error ? reason.message : "Integrations unavailable."));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadGuide(guideId).catch(() => setGuide(null));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [guideId, loadGuide]);

  async function testCard(card: IntegrationCard) {
    setTesting(card.testId);
    setTestNote("");
    try {
      const response = await fetch(`/api/integrations/${encodeURIComponent(card.testId)}/test`, { method: "POST" });
      const body = await response.json() as { status?: string; message?: string };
      setTestNote(`${card.label}: ${body.status ?? "unknown"} — ${body.message ?? ""}`);
    } catch (reason) {
      setTestNote(reason instanceof Error ? reason.message : "Test failed.");
    } finally {
      setTesting(null);
    }
  }

  async function saveConfig() {
    if (!payload || saving) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/integrations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: payload.config }),
      });
      const body = await response.json() as IntegrationsPayload & { message?: string };
      if (!response.ok) throw new Error(body.message || "Save failed");
      setPayload(body);
      setTestNote(body.message || "Saved.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function importCsv() {
    if (!csvText.trim()) return;
    const response = await fetch("/api/integrations/broker/csv", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csv: csvText }),
    });
    const body = await response.json() as { status?: string; message?: string; rows?: unknown[] };
    setTestNote(body.message || `CSV ${body.status}: ${body.rows?.length ?? 0} rows (cached, never live).`);
    await load();
  }

  const config = payload?.config;

  return (
    <div className="integrations-workspace-shell investment-workspace-shell" data-workspace="integrations">
      <header className="integrations-hero">
        <div>
          <p className="eyebrow">PIPELINE OWNERSHIP</p>
          <h2>Integrations</h2>
          <p>Connect the broker, research mailboxes, calendars, reminders, notes, and delayed quotes you own. This page has no action board, no earnings calendar, and no S-2 industry filter.</p>
        </div>
        <button type="button" onClick={() => void load()} title="Reload integrations registry">
          <RefreshCw size={15} /><span>Reload registry</span>
        </button>
      </header>
      {error && <p className="live-empty compact" role="alert">{error}</p>}
      {testNote && <p className="integrations-test-note">{testNote}</p>}
      <div className="integrations-layout">
        <section className="integrations-cards" aria-label="Integration pipelines">
          {(payload?.cards ?? []).map((card) => (
            <article key={card.id} className="integrations-card" data-status={statusTone(card.status)}>
              <header>
                <Plug size={16} aria-hidden="true" />
                <div>
                  <b>{card.label}</b>
                  <small>{card.pipeline} · {card.status}</small>
                </div>
                <em>{card.connected ? "Connected" : "Not live"}</em>
              </header>
              <p>{card.notes}</p>
              <ul>
                {card.requirements.map((item) => <li key={item}>{item}</li>)}
              </ul>
              <footer>
                <small>Last success IST: {card.lastSuccessIst ?? "—"}</small>
                <button type="button" onClick={() => { setGuideId(card.guideId); void testCard(card); }} disabled={testing === card.testId}>
                  {testing === card.testId ? "Testing…" : "Test"}
                </button>
              </footer>
            </article>
          ))}
        </section>
        <aside className="integrations-guide" aria-label="Setup guides">
          <div className="panel-title">
            <div><h3>Step-by-step guides</h3><p>API, MCP, TCC, and rejected paths</p></div>
            <Cable size={18} />
          </div>
          <div className="integrations-guide-tabs" role="tablist" aria-label="Integration guides">
            {(payload?.guides ?? Object.keys(GUIDE_LABELS)).map((id) => (
              <button key={id} type="button" role="tab" aria-selected={guideId === id} className={guideId === id ? "active" : ""} onClick={() => setGuideId(id)}>
                {GUIDE_LABELS[id] ?? id}
              </button>
            ))}
          </div>
          {guide ? (
            <article>
              <h4>{guide.title}</h4>
              <pre>{guide.body}</pre>
            </article>
          ) : <p>Select a guide.</p>}
        </aside>
      </div>
      {config && (
        <section className="integrations-editor" aria-label="Edit local integrations.json">
          <h3>Local registry</h3>
          <p>Saved to <code>artifacts/private/integrations.json</code>. Kite tokens are never stored here.</p>
          <label>Active broker id
            <input value={config.broker.id} onChange={(event) => setPayload((current) => current ? { ...current, config: { ...current.config, broker: { ...current.config.broker, id: event.target.value } } } : current)} />
          </label>
          <label>Newsletter mailbox
            <input
              value={`${config.newsletters[0]?.account ?? ""} / ${config.newsletters[0]?.mailbox ?? ""}`}
              onChange={(event) => {
                const [account, mailbox] = event.target.value.split("/").map((part) => part.trim());
                setPayload((current) => current ? {
                  ...current,
                  config: { ...current.config, newsletters: [{ account: account || "iCloud", mailbox: mailbox || "Newsletters" }] },
                } : current);
              }}
            />
          </label>
          <label>Earnings calendar name
            <input value={config.calendars.earningsName} onChange={(event) => setPayload((current) => current ? { ...current, config: { ...current.config, calendars: { ...current.config.calendars, earningsName: event.target.value } } } : current)} />
          </label>
          <label>Reminder lists (comma-separated)
            <input value={config.reminders.lists.join(", ")} onChange={(event) => setPayload((current) => current ? { ...current, config: { ...current.config, reminders: { lists: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) } } } : current)} />
          </label>
          <label>Obsidian vault
            <input value={config.notes.obsidianVault ?? ""} onChange={(event) => setPayload((current) => current ? { ...current, config: { ...current.config, notes: { ...current.config.notes, obsidianVault: event.target.value.trim() || null } } } : current)} placeholder="~/Documents/Obsidian" />
          </label>
          <button type="button" onClick={() => void saveConfig()} disabled={saving}>{saving ? "Saving…" : "Save integrations.json"}</button>
          <h3>CSV holdings (cached only)</h3>
          <p>For brokers without a public API. Imported rows stay <code>cached</code> and are never labelled live.</p>
          <textarea value={csvText} onChange={(event) => setCsvText(event.target.value)} rows={6} placeholder={"symbol,qty,avg\nINFY,10,1500"} />
          <button type="button" onClick={() => void importCsv()}>Import CSV as cached</button>
        </section>
      )}
    </div>
  );
}
