import type { HealthMetric, HealthTone } from "./health-data";

export type HealthCategorySnapshot = {
  name: string;
  note: string;
  tone: HealthTone;
  metrics: HealthMetric[];
};

export type HealthSourceSnapshot = {
  source: string;
  status: string;
  detail: string;
  tone: HealthTone;
};

export type HealthActionSnapshot = {
  tone: HealthTone;
  title: string;
  text: string;
};

export type HealthLiveSnapshot = {
  schemaVersion: 1;
  status: "live" | "stale" | "unavailable";
  source: "Apple Health";
  dataDate: string;
  capturedAt: string;
  receivedAt?: string;
  message: string;
  completedThrough?: string;
  partialToday?: boolean;
  missingDates?: string[];
  exportDate?: string;
  coverage?: Record<string, { firstDate: string; lastDate: string; records: number; weekly: boolean; monthly: boolean }>;
  categories: HealthCategorySnapshot[];
  sources: HealthSourceSnapshot[];
  actions?: HealthActionSnapshot[];
};
