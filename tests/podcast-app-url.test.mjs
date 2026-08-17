import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { applePodcastsAppUrl } from "../app/podcast-app-url.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("applePodcastsAppUrl always uses the Apple Podcasts app scheme", () => {
  assert.equal(
    applePodcastsAppUrl("https://podcasts.apple.com/podcast/id123?i=456"),
    "podcasts://podcasts.apple.com/podcast/id123?i=456",
  );
  assert.equal(
    applePodcastsAppUrl("https://podcasts.apple.com/us/podcast/daybreak/id123?i=456#t=1m30s"),
    "podcasts://podcasts.apple.com/us/podcast/daybreak/id123?i=456#t=1m30s",
  );
  assert.equal(
    applePodcastsAppUrl("podcasts://podcasts.apple.com/podcast/id123?i=456"),
    "podcasts://podcasts.apple.com/podcast/id123?i=456",
  );
  assert.equal(applePodcastsAppUrl("https://omny.fm/shows/example/ep"), "");
  assert.equal(applePodcastsAppUrl("javascript:alert(1)"), "");
  assert.equal(applePodcastsAppUrl(""), "");
});

test("Open in Podcasts hands Apple Podcasts URLs to the native app", () => {
  const workspace = readFileSync(join(root, "app/dashboard/IntelligenceWorkspace.tsx"), "utf8");
  const browser = readFileSync(join(root, "apple-app/InvestmentDashboard/DashboardBrowser.swift"), "utf8");
  const link = readFileSync(join(root, "apple-app/InvestmentDashboard/ApplePodcastsLink.swift"), "utf8");

  assert.match(workspace, /applePodcastsAppUrl/);
  assert.match(workspace, /opensNativeApp/);
  assert.match(browser, /openInApplePodcasts/);
  assert.match(browser, /ApplePodcastsLink\.isPodcastsURL/);
  assert.match(link, /com\.apple\.podcasts/);
  assert.match(link, /podcasts:\/\/|scheme = "podcasts"/);
});
