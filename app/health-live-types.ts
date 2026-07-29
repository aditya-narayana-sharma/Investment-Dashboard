import type { HealthMetric, HealthTone } from "./health-data";
import type { HealthTargetPolicy } from "./health-date-policy";

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
  status: "live" | "partial" | "cached" | "stale" | "unavailable";
  source: "Apple Health";
  dataDate: string;
  capturedAt: string;
  receivedAt?: string;
  message: string;
  completedThrough?: string;
  partialToday?: boolean;
  partialExportDay?: string;
  missingDates?: string[];
  exportDate?: string;
  exportCapturedAt?: string;
  targetDate?: string;
  targetPolicy?: HealthTargetPolicy;
  targetLabel?: string;
  requiredThrough?: string;
  eligibleThrough?: string;
  archiveStatus?: string;
  activeArchive?: string;
  rejectedArchive?: string;
  fallbackReason?: string;
  archive?: {
    status?: string;
    activeArchive?: string;
    rejectedArchive?: string;
    fallbackReason?: string;
    message?: string;
    [key: string]: unknown;
  };
  coverage?: Record<string, { firstDate: string; lastDate: string; records: number; weekly: boolean; monthly: boolean }>;
  categoryCoverage?: Record<string, { date: string; available: boolean; metricCount: number; recordCount: number }>;
  categories: HealthCategorySnapshot[];
  sources: HealthSourceSnapshot[];
  actions?: HealthActionSnapshot[];
};
