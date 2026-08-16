import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { StrategyGraphV2 } from "./graph-types";

export type StrategyRow = {
  id: string;
  name: string;
  description: string | null;
  interval: string;
  graph_json: StrategyGraphV2;
  created_at: string;
  updated_at: string;
};

export type BacktestRequestRow = {
  id: string;
  strategy_id: string;
  request_json: unknown;
  status: string;
  ran: boolean;
  created_at: string;
};

export type StrategyLibraryDatabase = {
  public: {
    Tables: {
      strategies: {
        Row: StrategyRow;
        Insert: StrategyRow;
        Update: Partial<StrategyRow>;
        Relationships: [];
      };
      backtest_requests: {
        Row: BacktestRequestRow;
        Insert: BacktestRequestRow;
        Update: Partial<BacktestRequestRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type StrategySupabaseClient = SupabaseClient<StrategyLibraryDatabase>;

const SERVER_ENV_KEYS = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const;

function requiredServerEnv(name: (typeof SERVER_ENV_KEYS)[number]): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required for the server-only Supabase client.`);
  }
  return value;
}

let adminClient: StrategySupabaseClient | null = null;

/** Service-role client. Reads only SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY. Never NEXT_PUBLIC_. */
export function createSupabaseAdminClient(): StrategySupabaseClient {
  if (typeof window !== "undefined") {
    throw new Error("The Supabase admin client is server-only and must not be imported in the browser.");
  }
  return createClient<StrategyLibraryDatabase>(
    requiredServerEnv("SUPABASE_URL"),
    requiredServerEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}

export function getSupabaseAdmin(): StrategySupabaseClient {
  if (!adminClient) {
    adminClient = createSupabaseAdminClient();
  }
  return adminClient;
}
