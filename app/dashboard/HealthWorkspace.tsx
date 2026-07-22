"use client";

import { Eye, EyeOff, ExternalLink, HeartPulse, NotebookTabs, ShieldAlert, Target } from "lucide-react";
import { healthActions, healthCaveats } from "../health-data";
import type { HealthLiveSnapshot } from "../health-live-types";
import { CollapsibleSection, DailyKanbanBoard, HealthMasonryGrid } from "./shared-ui";
import { compactHealthDate } from "./utils";

export function HealthWorkspace({
  healthIncognito,
  setHealthIncognito,
  healthSnapshot,
  healthCurrent,
  healthError,
  healthRequiredDate,
  healthMissingDates,
}: {
  healthIncognito: boolean;
  setHealthIncognito: (active: boolean) => void;
  healthSnapshot: HealthLiveSnapshot;
  healthCurrent: boolean;
  healthError: string;
  healthRequiredDate: string;
  healthMissingDates: string[];
}) {
  return <>
      <div className="workspace-section">
      <CollapsibleSection number="H-1" title="Health action board" note={healthIncognito ? "Hidden while Health Incognito is active" : "Daily source, trend and optimisation actions"}>
        {healthIncognito ? <section className="health-incognito-placeholder"><EyeOff size={28}/><h3>Health action board hidden</h3><p>Incognito also hides health-related actions and strategic notes.</p></section> : <DailyKanbanBoard workspace="health"/>}
      </CollapsibleSection>
      </div>

      <div className="workspace-section">
      <CollapsibleSection number="H-2" title="Health & wellness" note={healthIncognito ? "Health statistics hidden by Incognito" : `Private HealthKit snapshot · data through ${healthSnapshot.dataDate}`} headerAction={healthIncognito ? <span className="pill amber"><EyeOff size={12}/> INCOGNITO</span> : <span className={`pill ${healthCurrent ? "green" : "amber"}`}>{healthCurrent ? "LATEST" : "STALE"}</span>}>
      {healthIncognito ? <section className="health-incognito-placeholder"><EyeOff size={28}/><h3>Health statistics hidden</h3><p>Incognito removes all health values, comparisons and recommendations from the rendered dashboard.</p><button type="button" onClick={() => setHealthIncognito(false)}><Eye size={15}/> Show health statistics</button></section> : <>
        <section className={`health-privacy ${healthCurrent ? "current" : "stale"}`}><HeartPulse size={18}/><div><b>{healthCurrent ? "Latest completed-day HealthKit data" : `Missing completed-day HealthKit data: ${healthMissingDates.map(compactHealthDate).join(", ") || "iPhone sync required"}`}</b><span>{healthSnapshot.message}{healthError ? ` ${healthError}.` : ""} The dashboard checks again on open, focus, network reconnection and every five minutes. Body Measurements, Hearing and medication details remain excluded.</span></div><span className={`pill ${healthCurrent ? "green" : "amber"}`}>{healthCurrent ? "SYNCED" : "STALE"}</span></section>

        <section className="health-coverage-strip" aria-label="HealthKit completed-day coverage">
          <div><span>Required through</span><b>{compactHealthDate(healthRequiredDate)}</b><small>D-1 policy</small></div>
          <div><span>Latest received</span><b>{compactHealthDate(healthSnapshot.dataDate)}</b><small>{healthSnapshot.status === "live" ? "iPhone HealthKit" : "verified fallback"}</small></div>
          <div className={healthMissingDates.length ? "missing" : "complete"}><span>Missing days</span><b>{healthMissingDates.length ? healthMissingDates.map(compactHealthDate).join(" · ") : "None"}</b><small>{healthMissingDates.length ? "No source data received" : "Coverage complete"}</small></div>
        </section>

        <article className="panel health-source-panel health-source-compact"><div className="panel-title"><div><h3>Source reconciliation</h3><p>Latest normalized aggregates received from the iPhone</p></div><NotebookTabs size={18}/></div><div className="health-source-list">{healthSnapshot.sources.map(item=><div key={item.source}><span className={`dot ${item.tone}`}/><div><b>{item.source}</b><small>{item.detail}</small></div><span className={`pill ${item.tone}`}>{item.status}</span></div>)}</div><div className="health-source-warning"><ShieldAlert size={16}/><span>The iPhone app reads the latest completed day and computes 7-day and 30-day comparisons locally. Only normalized aggregates are sent privately to this Mac; raw HealthKit samples are not uploaded.</span></div></article>

        <HealthMasonryGrid categories={healthSnapshot.categories}/>

        <section className="health-action-grid">
          <article className="panel health-actions"><div className="panel-title"><div><h3>Daily optimisation</h3><p>{healthCurrent ? `Generated from ${healthSnapshot.dataDate} HealthKit aggregates` : "Last validated guidance; sync the iPhone before relying on it"}</p></div><Target size={18}/></div><div className="health-action-list">{(healthSnapshot.actions ?? healthActions).map(item=><div key={item.title}><span className={`dot ${item.tone}`}/><div><b>{item.title}</b><p>{item.text}</p></div></div>)}</div></article>
          <article className="panel health-caveat-panel"><div className="panel-title"><div><h3>Interpretation guardrails</h3><p>What this snapshot can and cannot support</p></div><ShieldAlert size={18}/></div><ul>{healthCaveats.map(item=><li key={item}>{item}</li>)}</ul><div className="health-guidance-links"><a href="https://support.apple.com/en-ie/120358" target="_blank" rel="noreferrer">Apple Watch oxygen limitations <ExternalLink size={13}/></a><a href="https://medlineplus.gov/lab-tests/pulse-oximetry/" target="_blank" rel="noreferrer">MedlinePlus pulse oximetry <ExternalLink size={13}/></a></div><p className="medical-note">Wellness summary only. It is not medical advice and should not be used to diagnose or change treatment.</p></article>
        </section>
      </>}
      </CollapsibleSection>
      </div>
  </>;
}
