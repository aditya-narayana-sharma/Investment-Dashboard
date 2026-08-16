import assert from "node:assert/strict";
import test from "node:test";
import { resolveStrategyStoreKind } from "../app/strategy/strategy-store.ts";

test("store facade selects sqlite when supabase env is missing or partial", () => {
  assert.equal(resolveStrategyStoreKind({}), "sqlite");
  assert.equal(resolveStrategyStoreKind({ SUPABASE_URL: "https://example.supabase.co" }), "sqlite");
  assert.equal(resolveStrategyStoreKind({ SUPABASE_SERVICE_ROLE_KEY: "service-role" }), "sqlite");
  assert.equal(resolveStrategyStoreKind({
    SUPABASE_URL: "   ",
    SUPABASE_SERVICE_ROLE_KEY: "service-role",
  }), "sqlite");
});

test("store facade selects supabase only when both server env vars are set", () => {
  assert.equal(resolveStrategyStoreKind({
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "service-role",
  }), "supabase");
});

test("store facade ignores NEXT_PUBLIC_ supabase keys", () => {
  assert.equal(resolveStrategyStoreKind({
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
    NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: "leaked-service-role",
  }), "sqlite");
  assert.equal(resolveStrategyStoreKind({
    NEXT_PUBLIC_SUPABASE_URL: "https://public.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "service-role",
  }), "supabase");
});
