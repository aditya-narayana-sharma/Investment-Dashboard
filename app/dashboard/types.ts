import type { AllocationSlice, LiveHolding } from "../live-types";

export type MacroEventKey = "oilWar" | "flows" | "rates" | "breadth" | "earnings";
export type MacroBandKey = "supportive" | "base" | "stress";
export type WorkspaceKey = "investment" | "sectors" | "intelligence" | "health" | "builder" | "strategies";
export type BuilderSection = "board" | "canvas" | "json";
export type StrategiesSection = "y1" | "y2";
export type SectorRankingView = "market" | "fundamentals";
export type KanbanWorkspace = WorkspaceKey;

export type KanbanSourceKind = "smart" | "source";

export type KanbanItem = {
  id: string;
  title: string;
  detail: string;
  numericAdvantage: string;
  strategicAdvantage: string;
  lane: "today" | "monitor";
  tone: "green" | "amber" | "red" | "blue";
  /** Card-chrome label. AI/LLM/Satya-minted cards use `Smart Actions`. */
  sourceLabel?: string;
  sourceKind?: KanbanSourceKind;
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
