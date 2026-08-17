"use client";

import type { ReactNode } from "react";
import { ArrowLeft, Plug, ShieldAlert } from "lucide-react";
import type { DashboardAppearance } from "./shared-ui";
import { AppearanceToggle, HealthIncognitoToggle } from "./shared-ui";

export function IntegrationsChrome({
  kiteStatus,
  kiteAsOf,
  kiteNote,
  kiteAction,
  appearance,
  onAppearance,
  healthIncognito,
  onHealthIncognito,
  onBack,
}: {
  kiteStatus: string;
  kiteAsOf: string;
  kiteNote: string;
  kiteAction: ReactNode;
  appearance: DashboardAppearance;
  onAppearance: (value: DashboardAppearance) => void;
  healthIncognito: boolean;
  onHealthIncognito: (active: boolean) => void;
  onBack: () => void;
}) {
  return (
    <main className="dashboard-app integrations-chrome">
      <a className="skip-link" href="#integrations-panel">Skip to integrations</a>
      <header className="masthead">
        <div>
          <div className="eyebrow">STRATJI CHROME · NOT A WORKSPACE</div>
          <h1>Integrations</h1>
          <p>Connect on-device pipelines. This page is settings chrome — it does not mount the Daily Action Board, industry filters, earnings calendar, or Health console.</p>
        </div>
        <div className="status-panel">
          <div><Plug size={16}/><span>Kite snapshot</span><b className={kiteStatus}>{kiteStatus.replaceAll("_", " ")}</b></div>
          <small>As of {kiteAsOf}</small>
          <AppearanceToggle value={appearance} onChange={onAppearance}/>
          <HealthIncognitoToggle active={healthIncognito} onChange={onHealthIncognito}/>
        </div>
      </header>

      <section id="integrations-panel" className="integrations-panel" aria-labelledby="integrations-heading">
        <h2 id="integrations-heading">Connection</h2>
        <p>{kiteNote}</p>
        <div className="integrations-actions">
          {kiteAction}
          <button type="button" className="secondary" onClick={onBack}><ArrowLeft size={15}/> Back to Portfolio Overview</button>
        </div>

        <article className="integrations-safety">
          <ShieldAlert size={18}/>
          <div>
            <h3>Safety</h3>
            <p>Secrets stay on this Mac. Writes need confirmation. <b>BUY/SELL, GTT/TSL, and alerts execute on live Kite cash equity from Portfolio</b> after a reviewed ticket — not from this page. Live strategy execution is only via Zerodha Streak.</p>
          </div>
        </article>
      </section>
    </main>
  );
}
