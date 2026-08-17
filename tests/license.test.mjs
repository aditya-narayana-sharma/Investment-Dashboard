import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  LICENSE_FEATURES,
  coercePublicLicense,
  defaultPublicLicense,
  featureForWorkspace,
  isMasterLicenseKey,
  mergeFetchedLicense,
  parseLicenseKey,
  resolvePublicLicense,
  tierAllows,
} from "../app/license.ts";

test("license keys parse Basic/Pro/Ultra prefixes and reject short tokens", () => {
  assert.equal(parseLicenseKey("stratji-pro-abcd"), "pro");
  assert.equal(parseLicenseKey("STRATJI_ULTRA_wxyz"), "ultra");
  assert.equal(parseLicenseKey("stratji-basic-1234"), "basic");
  assert.equal(parseLicenseKey("stratji-ultra-master-abcde"), "ultra");
  assert.equal(isMasterLicenseKey("stratji-ultra-master-abcde"), true);
  assert.equal(isMasterLicenseKey("stratji-ultra-demo1"), false);
  assert.equal(parseLicenseKey("stratji-pro-abc"), null);
  assert.equal(parseLicenseKey("not-a-key"), null);
  assert.equal(parseLicenseKey(""), null);
});

test("tier matrix gates workspaces without inventing data", () => {
  assert.equal(tierAllows("basic", "investment"), true);
  assert.equal(tierAllows("basic", "sectors"), true);
  assert.equal(tierAllows("basic", "integrations"), true);
  assert.equal(tierAllows("basic", "intelligence"), false);
  assert.equal(tierAllows("basic", "health"), false);
  assert.equal(tierAllows("basic", "sectorsS3"), false);
  assert.equal(tierAllows("basic", "pdf"), false);
  assert.equal(tierAllows("basic", "builder"), false);
  assert.equal(tierAllows("pro", "intelligence"), true);
  assert.equal(tierAllows("pro", "builder"), false);
  assert.equal(tierAllows("ultra", "builder"), true);
  assert.equal(tierAllows("ultra", "streak"), true);
  assert.equal(featureForWorkspace("intelligence"), "intelligence");
  assert.equal(defaultPublicLicense().tier, "basic");
  assert.equal(defaultPublicLicense().author, false);
});

test("license resolution prefers a well-formed key over operator override", () => {
  const fromKey = resolvePublicLicense({
    version: 1,
    tier: "basic",
    key: "stratji-ultra-demo1",
    operatorOverride: true,
    author: false,
    operatorTier: null,
    updatedAt: "2026-08-18T00:00:00.000Z",
  }, {});
  assert.equal(fromKey.tier, "ultra");
  assert.equal(fromKey.source, "key");
  assert.equal(fromKey.author, false);

  const operator = resolvePublicLicense({
    version: 1,
    tier: "pro",
    key: "",
    operatorOverride: true,
    author: false,
    operatorTier: "pro",
    updatedAt: "2026-08-18T00:00:00.000Z",
  }, {});
  assert.equal(operator.tier, "pro");
  assert.equal(operator.source, "operator");

  const envTier = resolvePublicLicense({
    version: 1,
    tier: "basic",
    key: "",
    operatorOverride: false,
    author: false,
    operatorTier: null,
    updatedAt: "",
  }, { STRATJI_LICENSE_TIER: "pro" });
  assert.equal(envTier.tier, "pro");
  assert.equal(envTier.source, "env");
});

test("author flag and master key unlock Ultra on this Mac", () => {
  const fromAuthor = resolvePublicLicense({
    version: 1,
    tier: "basic",
    key: "",
    operatorOverride: false,
    author: true,
    operatorTier: "ultra",
    updatedAt: "2026-08-18T00:00:00.000Z",
  }, {});
  assert.equal(fromAuthor.tier, "ultra");
  assert.equal(fromAuthor.source, "author");
  assert.equal(fromAuthor.author, true);
  assert.equal(tierAllows(fromAuthor.tier, "intelligence"), true);
  assert.equal(tierAllows(fromAuthor.tier, "builder"), true);

  const fromMaster = resolvePublicLicense({
    version: 1,
    tier: "basic",
    key: "stratji-ultra-master-abcde12345",
    operatorOverride: false,
    author: false,
    operatorTier: null,
    updatedAt: "2026-08-18T00:00:00.000Z",
  }, {});
  assert.equal(fromMaster.tier, "ultra");
  assert.equal(fromMaster.source, "author");
  assert.equal(fromMaster.author, true);
  assert.equal(fromMaster.key, "stratji-ultra-master-abcde12345");
});

test("client license fetch never flashes Basic over a server Ultra snapshot", () => {
  const ssrUltra = resolvePublicLicense({
    version: 1,
    tier: "basic",
    key: "stratji-ultra-master-ssrtest1",
    operatorOverride: false,
    author: true,
    operatorTier: "ultra",
    updatedAt: "2026-08-18T00:00:00.000Z",
  }, {});
  assert.equal(ssrUltra.tier, "ultra");
  assert.equal(mergeFetchedLicense(ssrUltra, defaultPublicLicense()).tier, "ultra");
  assert.equal(mergeFetchedLicense(ssrUltra, coercePublicLicense({ tier: "basic", source: "default" })).tier, "ultra");
  assert.equal(mergeFetchedLicense(ssrUltra, coercePublicLicense({ tier: "pro", source: "key", keyPresent: true })).tier, "ultra");
  const fromProFetch = mergeFetchedLicense(defaultPublicLicense(), coercePublicLicense({
    tier: "pro",
    source: "key",
    keyPresent: true,
    updatedAt: null,
    message: "",
    author: false,
    operatorTier: null,
    key: null,
  }));
  assert.equal(fromProFetch?.tier, "pro");
});

test("local master key file unlocks Ultra for SSR; empty clones stay Basic", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "stratji-license-"));
  const masterPath = path.join(root, "artifacts", "private", "license-master.txt");
  const emptyMaster = "";
  const emptyClone = resolvePublicLicense({
    version: 1,
    tier: "basic",
    key: "",
    operatorOverride: false,
    author: false,
    operatorTier: null,
    updatedAt: "",
  }, {}, emptyMaster);
  assert.equal(emptyClone.tier, "basic");
  assert.equal(emptyClone.author, false);
  assert.equal(emptyClone.source, "default");
  assert.equal(tierAllows(emptyClone.tier, "intelligence"), false);
  assert.equal(tierAllows(emptyClone.tier, "health"), false);
  assert.equal(tierAllows(emptyClone.tier, "sectorsS3"), false);
  assert.equal(tierAllows(emptyClone.tier, "pdf"), false);
  assert.equal(tierAllows(emptyClone.tier, "builder"), false);
  assert.equal(tierAllows(emptyClone.tier, "strategies"), false);

  await mkdir(path.dirname(masterPath), { recursive: true });
  await writeFile(masterPath, "stratji-ultra-master-ssrtest1\n");
  const fromFile = resolvePublicLicense({
    version: 1,
    tier: "basic",
    key: "",
    operatorOverride: false,
    author: false,
    operatorTier: null,
    updatedAt: "",
  }, {}, (await readFile(masterPath, "utf8")).trim());
  assert.equal(fromFile.tier, "ultra");
  assert.equal(fromFile.source, "author");
  assert.equal(fromFile.author, true);
  for (const feature of LICENSE_FEATURES) {
    assert.equal(tierAllows(fromFile.tier, feature), true, `${feature} should be unlocked on first paint`);
  }

  const server = await readFile(new URL("../app/license-server.ts", import.meta.url), "utf8");
  assert.match(server, /readMasterLicenseKey/);
  assert.match(server, /artifacts", "private", "license-master.txt"/);
  assert.match(server, /async function readDashboardLicense/);
  assert.match(server, /return await readPublicLicense\(\)/);
});

test("dashboard first paint uses the server license snapshot instead of a Basic default", async () => {
  const [page, layout, snapshot, integrations, tabs, report, sectors, nativeLicense, nativeBrowser] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/license-snapshot.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/IntegrationsWorkspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/shared-ui.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/report/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/SectorsWorkspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../apple-app/Shared/StratjiLicense.swift", import.meta.url), "utf8"),
    readFile(new URL("../apple-app/Shared/StratjiDocumentBrowser.swift", import.meta.url), "utf8"),
  ]);

  assert.match(layout, /readDashboardLicense/);
  assert.match(layout, /LicenseSnapshotProvider/);
  assert.match(layout, /initialLicense=\{license\}/);
  assert.match(layout, /data-license-tier=\{license\.tier\}/);
  assert.doesNotMatch(layout, /defaultPublicLicense\(\)/);

  assert.match(snapshot, /useState<PublicLicense>\(\(\) => coercePublicLicense\(initialLicense\)/);
  assert.match(snapshot, /mergeFetchedLicense/);

  assert.match(page, /useLicenseSnapshot/);
  assert.match(page, /data-license-tier=\{license\.tier\}/);
  assert.doesNotMatch(page, /useState<PublicLicense>\(\(\) => defaultPublicLicense\(\)\)/);
  assert.match(page, /Keep the SSR snapshot/);

  assert.match(integrations, /useLicenseSnapshot/);
  assert.doesNotMatch(integrations, /useState<PublicLicense>\(\(\) => defaultPublicLicense\(\)\)/);
  assert.doesNotMatch(integrations, /setLicense\(defaultPublicLicense\(\)\)/);

  assert.match(tabs, /licenseTier \?\? license\.tier/);
  assert.doesNotMatch(tabs, /licenseTier = "basic"/);

  assert.match(report, /tierAllows\(license\.tier, "pdf"\)/);
  assert.match(report, /LicenseGate feature="pdf"/);

  assert.match(sectors, /useLicenseSnapshot/);
  assert.match(sectors, /s3Locked \?\? !tierAllows\(resolvedLicense\.tier, "sectorsS3"\)/);

  assert.match(nativeLicense, /func webBootstrapScript/);
  assert.match(nativeLicense, /dataset.licenseTier/);
  assert.match(nativeBrowser, /StratjiLicenseStore\.webBootstrapScript\(\)/);
});
