import type { AllocationSlice, LiveHolding } from "../live-types";

export type MacroEventKey = "oilWar" | "flows" | "rates" | "breadth" | "earnings";
export type MacroBandKey = "supportive" | "base" | "stress";
export type WorkspaceKey = "investment" | "sectors" | "intelligence" | "health" | "builder" | "strategies" | "integrations";
export type BuilderSection = "board" | "canvas" | "json";
export type StrategiesSection = "y1" | "y2";
export type SectorRankingView = "market" | "fundamentals";
export type KanbanWorkspace = Exclude<WorkspaceKey, "integrations">;

export type KanbanItem = {
  id: string;
  title: string;
  detail: string;
  numericAdvantage: string;
  strategicAdvantage: string;
  lane: "today" | "monitor";
  tone: "green" | "amber" | "red" | "blue";
};

export type DonutLabelProps = {
  cx?: number | string;
  cy?: number | string;
  midAngle?: number;
  innerRadius?: number | string;
  outerRadius?: number | string;
  percent?: number;
  name?: string;
  payload?: AllocationSlice | LiveHolding;
};

export type StartupAudit = {
  status: string;
  failures?: number;
  failedSources?: string[];
  finishedAt?: string;
  message?: string;
};
