"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  LogIn,
  Plug,
  RefreshCw,
  ShieldAlert,
  Unplug,
} from "lucide-react";
import { KITE_LOGIN_HREF, openKiteLogin } from "../kite-auth-presentation";
import {
  defaultIntegrationsConfig,
  INTEGRATION_PIPELINE_IDS,
  APPLE_PERMISSION_SOURCE_IDS,
  applePermissionTitle,
  applePrivacySettingsUrl,
  appleSourceForPipeline,
  emptyApplePermission,
  isFirstRunApplePermissionSource,
  pipelineTitle,
  pipelineVenues,
  type ApplePermissionSourceId,
  type ApplePermissionStatus,
  type IntegrationPipelineId,
  type IntegrationStatus,
  type IntegrationVenueKind,
  type IntegrationsConfig,
  type IntegrationsWizard,
} from "../integrations-types";
import { LicenseGate } from "./LicenseGate";
import { AppearanceToggle, HealthIncognitoToggle, type DashboardAppearance } from "./shared-ui";
import { LICENSE_TIERS, TIER_LABELS, coercePublicLicense, tierAllows, type LicenseTier, type PublicLicense } from "../license";
import { useLicenseSnapshot } from "../license-snapshot";

const STREAK_EXPORT_CHECKLIST = `STRATJI STREAK EXPORT CHECKLIST (copy-only stub — not a live API)
Status: draft (user mirrors submitted / deployed / paused in Streak)

1. White-box strategy JSON attached (StrategyTreeV1). Missing KPIs stay —.
2. Static IP attested in the Zerodha / Streak console (user action).
3. OPS guidance: typical retail ≤10 unless the broker documents otherwise.
4. Algo-ID field filled when the broker issues one.
5. Change log: logic edits require re-approval in Streak before going live.
6. User deploys and confirms INSIDE Zerodha Streak.
7. Stratji core places ZERO unattended orders.

This is not a Streak scrape. Live trading is NOT claimed.`;

function statusLabel(status: IntegrationStatus): string {
  switch (status) {
    case "live":
      return "live";
    case "partial":
      return "partial";
    case "stale":
      return "stale";
    case "unavailable":
      return "unavailable";
    case "auth_required":
      return "auth required";
    case "not_configured":
      return "not configured";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

function permissionStatusLabel(status: ApplePermissionStatus): string {
  switch (status) {
    case "connected":
      return "Connected";
    case "permission_required":
      return "Permission required";
    case "denied":
      return "Denied";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

function requestNativeAppleConnect(source: ApplePermissionSourceId) {
  if (typeof window === "undefined") return;
  try {
    window.location.assign(`stratji://permissions/connect?source=${encodeURIComponent(source)}`);
  } catch {
    // Browser Settings still records local permission state via POST.
  }
}

function venueKindLabel(kind: IntegrationVenueKind): string {
  switch (kind) {
    case "live":
      return "live adapter";
    case "placeholder":
      return "placeholder";
    case "profile":
      return "mailbox profile";
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

function SecretInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="secret-input">
      {label}
      <span className="secret-input-row">
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete="off"
          spellCheck={false}
          placeholder={placeholder}
        />
        <button type="button" className="secret-toggle" onClick={() => setVisible((current) => !current)} aria-label={visible ? `Hide ${label}` : `Show ${label}`}>
          {visible ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </span>
    </label>
  );
}

function pipelinePlaybook(id: IntegrationPipelineId): { api: string; mcp: string; extra: string } {
  switch (id) {
    case "broker":
      return {
        api: "Create a Kite Connect app. Store API key/secret in the kite-mcp-server .env — never in this git repo. Use Authenticate Kite in the live-feed banner or on this card when Kite is not live.",
        mcp: "Set Kite MCP project dir in the wizard. scripts/ensure-kite-server.sh reads KITE_MCP_PROJECT_DIR.",
        extra: "Groww is a placeholder card. No live Groww API in this slice. Writes need typed confirmation on Kite tickets.",
      };
    case "research":
      return {
        api: "No house API. PDFs are local text-layer extracts from the configured research mailbox + folder profile.",
        mcp: "Optional Notion MCP is TARGET for research notes and must not be required to boot.",
        extra: "Profiles: Axis (seed), HDFC, SBI, ET-Prime, Moneycontrol. Promo and admin mail stay excluded.",
      };
    case "newsletters":
      return {
        api: "Apple Mail via the content digest. Exact mailbox name from the wizard.",
        mcp: "None at runtime.",
        extra: "Promo-strip INVARIANT: no ads, CTAs, phones, or links in displayed summaries.",
      };
    case "calendars":
      return {
        api: "Apple Calendar SQLite on this Mac. Google Calendar OAuth is TARGET, not this slice.",
        mcp: "None at runtime.",
        extra: "M-3 is the sole earnings calendar. Apple Calendar earnings rows are scheduling evidence only.",
      };
    case "reminders":
      return {
        api: "Apple Reminders read + EventKit complete with confirmation. Google Tasks is a placeholder.",
        mcp: "None at runtime.",
        extra: "Completed items are evidence only and must not be silently restored.",
      };
    case "notes":
      return {
        api: "TARGET adapters: Apple Notes, Obsidian vault path, Notion MCP, OneNote. Research only.",
        mcp: "Notion MCP optional. Never a Health source. Health Daily notes are deprecated.",
        extra: "Skills/plugins that create notes need user confirmation before writes.",
      };
    case "yfinance":
      return {
        api: "/api/quotes/yfinance and sector fetch scripts. No API key.",
        mcp: "None.",
        extra: "Free for all tiers. Paid Kite market-data is never required for Sectoral Analytics.",
      };
    case "sectors":
      return {
        api: "/api/sectors/snapshot|news|benchmarks.",
        mcp: "None.",
        extra: "S-2 industry filter must not leak into Market Intelligence or S-3.",
      };
    case "podcasts":
      return {
        api: "Apple Podcasts MTLibrary.sqlite + TTML. Optional Ollama drafts labelled machine-drafted.",
        mcp: "None.",
        extra: "Dedupe by normalized title. Label transcript only when a local transcript existed.",
      };
    case "health":
      return {
        api: "ZIP/XML import + POST /_health/snapshot from the paired iPhone. Raw samples stay on device.",
        mcp: "None.",
        extra: "Validate newest ZIP contains apple_health_export/export.xml. Keep last good XML if the archive is corrupt.",
      };
    case "tailscale":
      return {
        api: "Tailscale Serve publishes loopback Flask to the tailnet only.",
        mcp: "None.",
        extra: "iPhone is Tailscale-only. Broker tokens never belong in the iOS binary.",
      };
    case "llm":
      return {
        api: "User-supplied Anthropic or OpenAI keys, on-device summarization only.",
        mcp: "None required.",
        extra: "Label output machine-drafted. Paste keys locally in Settings. Empty key = assist disabled, not fake analysis.",
      };
    default: {
      const _exhaustive: never = id;
      return _exhaustive;
    }
  }
}

export function IntegrationsWorkspace({ showDashboardExit = false }: { showDashboardExit?: boolean } = {}) {
  const [config, setConfig] = useState<IntegrationsConfig>(() => defaultIntegrationsConfig());
  const [wizard, setWizard] = useState<IntegrationsWizard>(() => defaultIntegrationsConfig().wizard);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [busyPipeline, setBusyPipeline] = useState<IntegrationPipelineId | null>(null);
  const [busyAppleSource, setBusyAppleSource] = useState<ApplePermissionSourceId | null>(null);
  const [anthropicApiKey, setAnthropicApiKey] = useState("");
  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [cursorApiKey, setCursorApiKey] = useState("");
  const [savingKeys, setSavingKeys] = useState(false);
  const { license, setLicense } = useLicenseSnapshot();
  const [licenseKey, setLicenseKey] = useState("");
  const [licenseTierDraft, setLicenseTierDraft] = useState<LicenseTier>(() => license.tier);
  const [savingLicense, setSavingLicense] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/integrations?secrets=1", { cache: "no-store" });
      const payload = await response.json() as IntegrationsConfig | { error?: string };
      if (!response.ok) throw new Error("error" in payload && payload.error ? payload.error : `HTTP ${response.status}`);
      const next = payload as IntegrationsConfig;
      setConfig(next);
      setWizard(next.wizard);
      setAnthropicApiKey("");
      setOpenaiApiKey("");
      setGeminiApiKey("");
      setCursorApiKey("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load local integrations config.");
    } finally {
      setLoading(false);
    }
    try {
      const licenseResponse = await fetch("/api/license", { cache: "no-store" });
      const licensePayload = coercePublicLicense(await licenseResponse.json());
      if (licenseResponse.ok && licensePayload) {
        setLicense(licensePayload);
        setLicenseTierDraft(licensePayload.tier);
      }
    } catch {
      /* Keep the SSR snapshot. Do not flash Basic over author Ultra. */
    }
  }, [setLicense]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const saveWizard = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/integrations", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ wizard, wizardComplete: true }),
      });
      const payload = await response.json() as IntegrationsConfig | { error?: string };
      if (!response.ok) throw new Error("error" in payload && payload.error ? payload.error : `HTTP ${response.status}`);
      const next = payload as IntegrationsConfig;
      setConfig(next);
      setWizard(next.wizard);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save wizard.");
    } finally {
      setSaving(false);
    }
  };

  const saveLicense = async (event: FormEvent) => {
    event.preventDefault();
    setSavingLicense(true);
    setError("");
    try {
      const response = await fetch("/api/license", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(licenseKey.trim()
          ? { key: licenseKey.trim() }
          : { tier: licenseTierDraft, operatorOverride: true }),
      });
      const raw = await response.json() as PublicLicense & { error?: string };
      if (!response.ok) throw new Error(raw.error || `HTTP ${response.status}`);
      const payload = coercePublicLicense(raw);
      if (!payload) throw new Error("Could not save license.");
      setLicense(payload);
      setLicenseTierDraft(payload.tier);
      if (payload.key) setLicenseKey(payload.key);
      else if (payload.source === "key" && !payload.author) setLicenseKey("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save license.");
    } finally {
      setSavingLicense(false);
    }
  };

  const runAction = async (pipelineId: IntegrationPipelineId, action: "connect" | "disconnect" | "test") => {
    setBusyPipeline(pipelineId);
    setError("");
    try {
      const appleSource = action === "connect" ? appleSourceForPipeline(pipelineId) : null;
      if (appleSource) requestNativeAppleConnect(appleSource);
      const response = await fetch("/api/integrations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pipelineId, action }),
      });
      const payload = await response.json() as IntegrationsConfig | { error?: string };
      if (!response.ok) throw new Error("error" in payload && payload.error ? payload.error : `HTTP ${response.status}`);
      setConfig(payload as IntegrationsConfig);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update pipeline.");
    } finally {
      setBusyPipeline(null);
    }
  };

  const runApplePermission = async (source: ApplePermissionSourceId) => {
    setBusyAppleSource(source);
    setError("");
    try {
      requestNativeAppleConnect(source);
      await new Promise((resolve) => window.setTimeout(resolve, 1200));
      const response = await fetch("/api/integrations?secrets=1", { cache: "no-store" });
      const payload = await response.json() as IntegrationsConfig | { error?: string };
      if (!response.ok) throw new Error("error" in payload && payload.error ? payload.error : `HTTP ${response.status}`);
      setConfig(payload as IntegrationsConfig);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not refresh Apple permission.");
    } finally {
      setBusyAppleSource(null);
    }
  };

  const saveLlmKeys = async (event: FormEvent) => {
    event.preventDefault();
    setSavingKeys(true);
    setError("");
    try {
      const llm: {
        anthropicApiKey?: string;
        openaiApiKey?: string;
        geminiApiKey?: string;
        cursorApiKey?: string;
      } = {};
      if (anthropicApiKey.trim()) llm.anthropicApiKey = anthropicApiKey.trim();
      if (openaiApiKey.trim()) llm.openaiApiKey = openaiApiKey.trim();
      if (geminiApiKey.trim()) llm.geminiApiKey = geminiApiKey.trim();
      if (cursorApiKey.trim()) llm.cursorApiKey = cursorApiKey.trim();
      const response = await fetch("/api/integrations", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ llm }),
      });
      const payload = await response.json() as IntegrationsConfig | { error?: string };
      if (!response.ok) throw new Error("error" in payload && payload.error ? payload.error : `HTTP ${response.status}`);
      setConfig(payload as IntegrationsConfig);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not store keys locally.");
    } finally {
      setSavingKeys(false);
    }
  };

  const clearLlmKeys = async () => {
    setSavingKeys(true);
    setError("");
    try {
      const response = await fetch("/api/integrations", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ clearLlmKeys: true }),
      });
      const payload = await response.json() as IntegrationsConfig | { error?: string };
      if (!response.ok) throw new Error("error" in payload && payload.error ? payload.error : `HTTP ${response.status}`);
      setConfig(payload as IntegrationsConfig);
      setAnthropicApiKey("");
      setOpenaiApiKey("");
      setGeminiApiKey("");
      setCursorApiKey("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not clear local keys.");
    } finally {
      setSavingKeys(false);
    }
  };

  const savePreferences = async (next: { appearance?: DashboardAppearance; healthIncognito?: boolean }) => {
    const appearance = next.appearance ?? config.appearance;
    const healthIncognito = next.healthIncognito ?? config.healthIncognito;
    setConfig((current) => ({ ...current, appearance, healthIncognito }));
    window.localStorage.setItem("dashboard-appearance", appearance);
    window.localStorage.setItem("dashboard-health-incognito", healthIncognito ? "1" : "0");
    document.documentElement.dataset.appearance = appearance;
    window.dispatchEvent(new CustomEvent("stratji-preferences-changed", { detail: { appearance, healthIncognito } }));
    setError("");
    try {
      const response = await fetch("/api/integrations", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ appearance, healthIncognito }),
      });
      const payload = await response.json() as IntegrationsConfig | { error?: string };
      if (!response.ok) throw new Error("error" in payload && payload.error ? payload.error : `HTTP ${response.status}`);
      setConfig(payload as IntegrationsConfig);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save appearance.");
    }
  };

  const copyChecklist = async () => {
    await navigator.clipboard.writeText(STREAK_EXPORT_CHECKLIST);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="integrations-workspace" data-workspace="integrations" data-chrome="integrations">
      <header className="integrations-hero">
        <p className="eyebrow">STRATJI CHROME · NOT A WORKSPACE</p>
        <h2 id="integrations-chrome-heading">Settings</h2>
        <p>
          Connect on-device pipelines. This page is settings chrome — it does not mount the Daily Action Board,
          industry filters, earnings calendar, Health console, or the six workspace launchers. Secrets stay on this Mac.
          Writes need confirmation. Live strategy execution is only via Zerodha Streak.
        </p>
        {showDashboardExit && (
          <p className="integrations-exit">
            <Link href="/?view=investment">Back to dashboard</Link>
          </p>
        )}
      </header>

      <aside className="integrations-safety" role="note">
        <ShieldAlert size={18} aria-hidden="true" />
        <div>
          <b>Safety</b>
          <small>
            Connect / test / disconnect write gitignored local config only. They do not place Kite orders.
            Confirmed BUY/SELL and GTT from reviewed tickets ARE live Kite orders after you type confirmation.
            Optional LLM keys stay on-device. Label that output machine-drafted.
            Stratji never silently auto-trades.
          </small>
        </div>
      </aside>

      {APPLE_PERMISSION_SOURCE_IDS.filter(isFirstRunApplePermissionSource).some((id) => config.applePermissions[id]?.status !== "connected") && (
        <aside className="integrations-safety" data-apple-onboarding="1" role="note">
          <ShieldAlert size={18} aria-hidden="true" />
          <div>
            <b>First-run Apple permissions</b>
            <small>
              Grant Mail, Calendar, Reminders, and Podcasts so Stratji can refresh those sources the same way it does today.
              This does not block the dashboard. Notes is optional research-only and is never a Health source.
            </small>
          </div>
        </aside>
      )}

      {error && <p className="integrations-error" role="alert">{error}</p>}
      {loading && <p className="integrations-muted">Loading local config…</p>}

      <section className="integrations-wizard" aria-labelledby="integrations-license-heading">
        <h3 id="integrations-license-heading">License · Basic / Pro / Ultra</h3>
        <p className="integrations-muted">
          This Mac is on <b>{TIER_LABELS[license.tier]}</b> ({license.source}{license.author ? " · author" : ""}). v1 is an honor + key file at
          <code> ~/Library/Application Support/Stratji/license.json</code> — not Auth0 and not a billing server.
          Downstream clones stay Basic until they paste <code>stratji-pro-yourtoken</code> or <code>stratji-ultra-yourtoken</code>.
          {license.author ? " The master license file stays on this Mac and is never sent to the browser." : ""}
        </p>
        <form className="integrations-wizard-grid" onSubmit={(event) => void saveLicense(event)}>
          <label>
            License key
            <input
              value={licenseKey}
              onChange={(event) => setLicenseKey(event.target.value)}
              placeholder="stratji-pro-xxxx"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <label>
            Operator tier (this Mac)
            <select
              value={licenseTierDraft}
              onChange={(event) => setLicenseTierDraft(event.target.value as LicenseTier)}
            >
              {LICENSE_TIERS.map((tier) => (
                <option key={tier} value={tier}>{TIER_LABELS[tier]}</option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={savingLicense}>
            <CheckCircle2 size={15} />
            <span>{savingLicense ? "Saving…" : "Save license"}</span>
          </button>
        </form>
      </section>

      <section className="integrations-wizard" aria-labelledby="integrations-appearance-heading">
        <h3 id="integrations-appearance-heading">Appearance</h3>
        <p className="integrations-muted">
          Theme and Health Incognito live here — not on the live dashboard masthead. Health Incognito hides values, drill-downs, source metadata, and recommendations until you turn it off.
        </p>
        <div className="integrations-appearance">
          <AppearanceToggle value={config.appearance} onChange={(appearance) => void savePreferences({ appearance })}/>
          <HealthIncognitoToggle active={config.healthIncognito} onChange={(healthIncognito) => void savePreferences({ healthIncognito })}/>
        </div>
      </section>

      <section className="integrations-wizard" aria-labelledby="integrations-wizard-heading">
        <h3 id="integrations-wizard-heading">First-run / settings wizard</h3>
        <p className="integrations-muted">
          Set <b>your</b> Kite MCP path, mailbox names, reminder lists, and Health ZIP folder. Empty fields are placeholders — they are not someone else’s machine.
          Saved config: <code>artifacts/private/integrations-config.json</code> (gitignored) and <code>~/Library/Application Support/Stratji/</code>.
        </p>
        <form className="integrations-wizard-grid" onSubmit={(event) => void saveWizard(event)}>
          <label>
            Kite MCP project dir
            <input
              value={wizard.kiteMcpProjectDir}
              onChange={(event) => setWizard((current) => ({ ...current, kiteMcpProjectDir: event.target.value }))}
              autoComplete="off"
              spellCheck={false}
            />
            <small>Env override: <code>KITE_MCP_PROJECT_DIR</code>. Point this at your local kite-mcp-server clone.</small>
          </label>
          <label>
            Newsletters mailbox
            <input
              value={wizard.newslettersMailbox}
              onChange={(event) => setWizard((current) => ({ ...current, newslettersMailbox: event.target.value }))}
            />
          </label>
          <label>
            Research mailbox
            <input
              value={wizard.researchMailbox}
              onChange={(event) => setWizard((current) => ({ ...current, researchMailbox: event.target.value }))}
            />
          </label>
          <label>
            Reminder list names (comma-separated)
            <input
              value={wizard.reminderListNames.join(", ")}
              onChange={(event) => setWizard((current) => ({
                ...current,
                reminderListNames: event.target.value.split(",").map((item) => item.trim()).filter(Boolean),
              }))}
            />
          </label>
          <label>
            Health ZIP folder
            <input
              value={wizard.healthZipFolder}
              onChange={(event) => setWizard((current) => ({ ...current, healthZipFolder: event.target.value }))}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <label>
            Tailscale URL
            <input
              value={wizard.tailscaleUrl}
              onChange={(event) => setWizard((current) => ({ ...current, tailscaleUrl: event.target.value }))}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <button type="submit" disabled={saving}>
            <CheckCircle2 size={15} />
            <span>{saving ? "Saving…" : config.wizardComplete ? "Update local config" : "Save first-run config"}</span>
          </button>
        </form>
      </section>

      <section className="integrations-pipelines" aria-labelledby="integrations-apple-heading">
        <h3 id="integrations-apple-heading">Apple apps</h3>
        <p className="integrations-muted">
          Connect asks macOS for permission inside Stratji.app (EventKit for Calendar and Reminders; Apple Events for Mail, Podcasts, and Notes).
          After you grant full access, the existing Mail / Calendar / Reminders / Podcasts refresh pipelines keep updating the dashboard.
          Notes is optional research only — it is never piped into Health.
        </p>
        <div className="integrations-card-grid">
          {APPLE_PERMISSION_SOURCE_IDS.map((id) => {
            const permission = config.applePermissions[id] ?? emptyApplePermission(id);
            const busy = busyAppleSource === id;
            return (
              <article key={id} className="integrations-card" data-apple-source={id} data-permission={permission.status}>
                <header>
                  <h4>{applePermissionTitle(id)}</h4>
                  <em className={`integrations-status ${permission.status}`}>{permissionStatusLabel(permission.status)}</em>
                </header>
                <p>{permission.notes}</p>
                <small>TCC: {permission.tcc}{permission.lastChecked ? ` · ${permission.lastChecked}` : ""}</small>
                <div className="integrations-card-actions">
                  <button type="button" disabled={busy} onClick={() => void runApplePermission(id)}>
                    <Plug size={14} /> Connect
                  </button>
                  {permission.status === "denied" && (
                    <a className="integrations-privacy-link" href={applePrivacySettingsUrl(id)}>
                      Open Privacy Settings
                    </a>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="integrations-pipelines" aria-labelledby="integrations-pipelines-heading">
        <h3 id="integrations-pipelines-heading">Pipelines</h3>
        <div className="integrations-card-grid">
          {INTEGRATION_PIPELINE_IDS.map((id) => {
            const pipeline = config.pipelines[id];
            const playbook = pipelinePlaybook(id);
            const busy = busyPipeline === id;
            return (
              <article key={id} className="integrations-card" data-pipeline={id} data-status={pipeline.status}>
                <header>
                  <h4>{pipelineTitle(id)}</h4>
                  <em className={`integrations-status ${pipeline.status}`}>{statusLabel(pipeline.status)}</em>
                </header>
                <p>{pipeline.notes}</p>
                <ul className="integrations-venues">
                  {pipelineVenues(id).map((venue) => (
                    <li key={venue.name}>
                      <b>{venue.name}</b>
                      <span>{venueKindLabel(venue.kind)}</span>
                    </li>
                  ))}
                </ul>
                <small>Last validated: {pipeline.lastValidated ?? "never"}</small>
                <dl>
                  <dt>API</dt>
                  <dd>{playbook.api}</dd>
                  <dt>MCP</dt>
                  <dd>{playbook.mcp}</dd>
                  <dt>Skills / plugins / agents</dt>
                  <dd>{playbook.extra}</dd>
                </dl>
                <div className="integrations-card-actions">
                  {id === "broker" && (
                    <a className="integrations-kite-login" href={KITE_LOGIN_HREF} target="_blank" rel="noreferrer" onClick={(event) => { event.preventDefault(); void openKiteLogin(); }}>
                      <LogIn size={14} /> Authenticate Kite
                    </a>
                  )}
                  <button type="button" disabled={busy} onClick={() => void runAction(id, "connect")}>
                    <Plug size={14} /> Connect
                  </button>
                  <button type="button" disabled={busy} onClick={() => void runAction(id, "test")}>
                    <RefreshCw size={14} /> Test
                  </button>
                  <button type="button" disabled={busy} onClick={() => void runAction(id, "disconnect")}>
                    <Unplug size={14} /> Disconnect
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="integrations-playbooks" aria-labelledby="integrations-playbooks-heading">
        <h3 id="integrations-playbooks-heading">API · MCP · Skills · plugins · agents</h3>
        <ol className="integrations-steps">
          <li><b>API.</b> Kite tickets stay reviewed. yfinance has no key. Optional LLM keys never become the source of numbers.</li>
          <li><b>MCP.</b> Runtime Kite MCP is server-only. Authoring MCPs (Notion, Zapier, Figma, …) are Cursor-only and must not be required to boot Stratji.</li>
          <li><b>Skills.</b> Load <code>refresh-investment-dashboard</code> before claiming sources are current. Exhaustive TypeScript switches; imports at top of file.</li>
          <li><b>Plugins.</b> Do not bake Cursor plugin credentials into Stratji.app. Firecrawl/Apify never substitute IR/NSE for earnings KPIs.</li>
          <li><b>Agents.</b> Dashboard steward, refresh auditor, builder/compiler, native-app maintainer, integrations-wizard author. Computer Use is optional deep-audit, not a scheduler.</li>
        </ol>
      </section>

      <section className="integrations-streak" aria-labelledby="integrations-streak-heading">
        <h3 id="integrations-streak-heading">Streak export checklist (Ultra)</h3>
        {tierAllows(license.tier, "streak") ? (
          <>
        <p className="integrations-muted">
          Copy-only. This does not scrape Streak and does not enable live auto-trade. User deploys in Zerodha Streak.
        </p>
        <pre className="integrations-checklist">{STREAK_EXPORT_CHECKLIST}</pre>
        <button type="button" onClick={() => void copyChecklist()}>
          {copied ? <CheckCircle2 size={15} /> : <Copy size={15} />}
          <span>{copied ? "Copied" : "Copy checklist"}</span>
        </button>
          </>
        ) : (
          <LicenseGate feature="streak" license={license} title="Streak export checklist" />
        )}
      </section>

      <section className="integrations-llm" aria-labelledby="integrations-llm-heading">
        <h3 id="integrations-llm-heading"><KeyRound size={16} /> Optional model keys</h3>
        <p className="integrations-muted">
          Paste Claude, OpenAI, Gemini, or Cursor keys here. They stay in gitignored `.env.local` and
          `artifacts/private` on this Mac — never commit them. Summaries, composite commentary, S-3 framework
          drafts, Algorithm Canvas assist, and Strategies assist use the first available key (Claude, then OpenAI,
          then Gemini). Empty keys disable those features with a Settings link; they never invent analysis.
          Cursor is stored but completions need Claude, OpenAI, or Gemini. Label output machine-drafted.
        </p>
        <form className="integrations-wizard-grid" onSubmit={(event) => void saveLlmKeys(event)}>
          <SecretInput
            label="Claude API key"
            value={anthropicApiKey}
            onChange={setAnthropicApiKey}
            placeholder={config.llm.anthropicKeyConfigured ? "stored locally" : "optional"}
          />
          <SecretInput
            label="OpenAI API key"
            value={openaiApiKey}
            onChange={setOpenaiApiKey}
            placeholder={config.llm.openaiKeyConfigured ? "stored locally" : "optional"}
          />
          <SecretInput
            label="Gemini API key"
            value={geminiApiKey}
            onChange={setGeminiApiKey}
            placeholder={config.llm.geminiKeyConfigured ? "stored locally" : "optional"}
          />
          <SecretInput
            label="Cursor API key"
            value={cursorApiKey}
            onChange={setCursorApiKey}
            placeholder={config.llm.cursorKeyConfigured ? "stored locally" : "optional"}
          />
          <div className="integrations-card-actions">
            <button type="submit" disabled={savingKeys || (!anthropicApiKey.trim() && !openaiApiKey.trim() && !geminiApiKey.trim() && !cursorApiKey.trim())}>
              <KeyRound size={14} />
              <span>{savingKeys ? "Saving…" : "Store keys locally"}</span>
            </button>
            <button type="button" disabled={savingKeys} onClick={() => void clearLlmKeys()}>
              <Unplug size={14} /> Clear stored keys
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
