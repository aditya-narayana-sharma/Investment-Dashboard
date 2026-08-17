/** Hands-on Stratji demo tour. Driven by Playwright against ?demo=1. */

export const BASE_URL = process.env.DASHBOARD_PUBLIC_URL ?? "http://127.0.0.1:5050";
const DWELL_MS = Number(process.env.DEMO_DWELL_MS ?? 5000);
const CHART_DWELL_MS = Number(process.env.DEMO_CHART_DWELL_MS ?? 7000);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function setCaption(page, title, body = "") {
  await page.evaluate(({ nextTitle, nextBody }) => {
    document.documentElement.dataset.demoCaption = nextBody ? `${nextTitle}\n${nextBody}` : nextTitle;
  }, { nextTitle: title, nextBody: body });
}

async function visible(page, selector) {
  const locator = page.locator(selector).first();
  if (await locator.count() === 0) return false;
  return locator.isVisible().catch(() => false);
}

async function clickIf(page, selector) {
  const locator = page.locator(selector).first();
  if (await locator.count() === 0) return false;
  if (!(await locator.isVisible().catch(() => false))) return false;
  const disabled = await locator.isDisabled().catch(() => false);
  if (disabled) return false;
  await locator.click({ timeout: 8000, force: true });
  return true;
}

async function scrollInto(page, selector) {
  const locator = page.locator(selector).first();
  if (await locator.count() === 0) return false;
  if (!(await locator.isVisible().catch(() => false))) return false;
  await locator.scrollIntoViewIfNeeded({ timeout: 4000 }).catch(() => undefined);
  return true;
}

async function hoverChart(page, selector = ".recharts-surface, .nested-chart-wrap, .portfolio-map, .symphony-curve, .symphony-tree") {
  const locator = page.locator(selector).first();
  if (await locator.count() === 0) return;
  if (!(await locator.isVisible().catch(() => false))) return;
  await locator.scrollIntoViewIfNeeded({ timeout: 4000 }).catch(() => undefined);
  const box = await locator.boundingBox();
  if (!box) return;
  await page.mouse.move(box.x + box.width * 0.42, box.y + box.height * 0.48);
}

async function dwell(ms = DWELL_MS) {
  await sleep(ms);
}

async function waitReady(page) {
  await page.waitForSelector("main.dashboard-app, .workspace-navigation", { timeout: 25_000 });
  await sleep(700);
}

async function openWorkspace(page, key, section) {
  const url = new URL(BASE_URL);
  url.searchParams.set("demo", "1");
  url.searchParams.set("view", key);
  if (section) url.searchParams.set("section", section);
  await page.goto(url.href, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await waitReady(page);
}

async function openSection(page, id) {
  await page.evaluate((sectionId) => {
    document.getElementById(`workspace-section-tab-${sectionId}`)?.click();
    for (const prefix of ["investment", "sector", "intelligence", "builder", "strategies"]) {
      const root = document.getElementById(`${prefix}-${sectionId}`);
      const button = root?.querySelector(".collapse-button");
      if (button && button.getAttribute("aria-expanded") !== "true") button.click();
    }
  }, id);
  await sleep(500);
}

export async function prepareDemoPage(page) {
  await page.addInitScript(() => {
    const numbers = ["I-1", "I-2", "I-3", "I-4", "S-1", "S-2", "S-3", "M-1", "M-2", "M-3", "M-4", "B-1", "B-2", "B-3", "Y-1", "Y-2"];
    for (const number of numbers) window.localStorage.setItem(`portfolio-section-v2-${number}-open`, "true");
    window.addEventListener("mousemove", (event) => {
      let pointer = document.getElementById("demo-pointer");
      if (!pointer) {
        pointer = document.createElement("div");
        pointer.id = "demo-pointer";
        document.body.appendChild(pointer);
      }
      pointer.style.left = `${event.clientX}px`;
      pointer.style.top = `${event.clientY}px`;
    }, { passive: true });
  });
}

export async function runDemoTour(page) {
  await page.goto(`${BASE_URL}/?demo=1&view=investment&section=i1`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await waitReady(page);

  await setCaption(page, "Stratji Dashboard", "Five product workspaces: Investment, Sectoral Analytics, Market Intelligence, Algorithm Canvas, and Strategies. Live Kite and research — amounts blurred.");
  await dwell(CHART_DWELL_MS);
  await page.locator(".workspace-tabs").hover().catch(() => undefined);
  await dwell(DWELL_MS);

  const steps = [
    ["Investment", tourInvestment],
    ["Sectoral Analytics", tourSectors],
    ["Market Intelligence", tourIntelligence],
    ["Algorithm Canvas", tourBuilder],
    ["Strategies", tourStrategies],
  ];
  for (const [label, step] of steps) {
    try {
      await step(page);
    } catch (error) {
      console.warn(`Demo tour step failed (${label}):`, error instanceof Error ? error.message : error);
      await setCaption(page, `${label} — continuing`, "This surface had a navigation hiccup; the tour continues to the next workspace.");
      await dwell(DWELL_MS);
    }
  }

  await setCaption(page, "Stratji — Investment through Strategies", "Action boards, live portfolio, sector labs, research calendar, tree editor, and the public strategy library.");
  await dwell(CHART_DWELL_MS);
}

async function tourInvestment(page) {
  await openWorkspace(page, "investment", "i1");

  await setCaption(page, "Investment · I-1 Action Board", "Shared three-lane Daily Action Board: To do today, Monitor, and Completed today.");
  await openSection(page, "i1");
  await scrollInto(page, "#investment-i1 .kanban-board");
  await clickIf(page, "#investment-i1 .kanban-lane.today .kanban-card");
  await dwell();

  await setCaption(page, "Investment · I-2 Portfolio", "Gauges, nested allocation, concentration map, and Kite activity. INR amounts and quantities are blurred.");
  await openSection(page, "i2");
  await scrollInto(page, ".instrument-cluster");
  await dwell();
  await scrollInto(page, ".nested-chart-panel");
  await hoverChart(page, ".nested-chart-wrap, .recharts-surface");
  await dwell(CHART_DWELL_MS);
  await scrollInto(page, ".portfolio-management");
  await dwell();
  await scrollInto(page, ".portfolio-map-panel");
  await hoverChart(page, ".portfolio-map-tile");
  await dwell(CHART_DWELL_MS);

  const activityLabels = ["Holdings", "Orders", "Positions", "GTTs", "TSLs", "Alerts"];
  for (const label of activityLabels) {
    await setCaption(page, `Investment · I-2 ${label}`, "Portfolio activity tabs stay on the same I-2 surface. Tickets open read-only and are dismissed.");
    await clickIf(page, `.portfolio-activity-tabs button:has-text("${label}")`);
    await dwell(4000);
  }
  await clickIf(page, ".portfolio-activity-tabs button:has-text(\"Holdings\")");
  if (await clickIf(page, ".holdings-matrix button.buy:not([disabled])")) {
    await dwell(3000);
    await clickIf(page, ".kite-order-ticket button.secondary, .kite-order-ticket button[aria-label='Close order ticket']");
    await sleep(400);
  }

  await setCaption(page, "Investment · I-3 Risk", "Macro scenario lab, stacked risk composition, and holdings radar.");
  await openSection(page, "i3");
  await scrollInto(page, ".macro-scenario-panel");
  const eventCount = await page.locator(".macro-event-tabs button").count();
  for (let index = 0; index < eventCount; index += 1) {
    await page.locator(".macro-event-tabs button").nth(index).click();
    await dwell(3500);
    if (await visible(page, ".macro-event-detail .recharts-surface")) {
      await hoverChart(page, ".macro-event-detail .recharts-surface");
      await dwell(CHART_DWELL_MS);
    }
  }
  const bandCount = await page.locator(".scenario-tabs button").count();
  for (let index = 0; index < bandCount; index += 1) {
    await page.locator(".scenario-tabs button").nth(index).click();
    await dwell(3000);
  }
  await scrollInto(page, ".exposure-composition-panel");
  await hoverChart(page, ".exposure-composition-panel .recharts-surface");
  await dwell(CHART_DWELL_MS);
  await scrollInto(page, ".holdings-stack");
  await hoverChart(page, ".holdings-stack .recharts-surface");
  if (await page.locator(".holdings-stack button, .holdings-stack select, .risk-panel button").count()) {
    await clickIf(page, ".holdings-stack [role='listbox'] button, .risk-panel button");
  }
  await dwell();

  await setCaption(page, "Investment · I-4 Axis picks", "Analyst call matrix, recommendation workbench, and recommended risk radar.");
  await openSection(page, "i4");
  if (await visible(page, "#analyst-group-by")) {
    await page.selectOption("#analyst-group-by", "industries").catch(() => undefined);
    await dwell(3000);
    await page.selectOption("#analyst-group-by", "calls").catch(() => undefined);
  }
  const groupCount = await page.locator(".axis-pick-group").count();
  for (let index = 0; index < groupCount; index += 1) {
    await scrollInto(page, `.axis-pick-group >> nth=${index}`);
    await dwell(3000);
  }
  await scrollInto(page, ".risk-panel, .analyst-matrix");
  await hoverChart(page);
  await dwell(CHART_DWELL_MS);
}

async function tourSectors(page) {
  await openWorkspace(page, "sectors", "s1");

  await setCaption(page, "Sectoral Analytics · S-1 Action Board", "Same canonical three-lane board, scoped to sector research.");
  await openSection(page, "s1");
  await scrollInto(page, "#sector-s1 .kanban-board");
  await dwell();

  await setCaption(page, "Sectoral Analytics · S-2 Industry filter", "S-2-only industry toggles. Selected industries update analytics; others dim in S-2 only.");
  await openSection(page, "s2");
  await clickIf(page, ".sector-selector button:has-text(\"Pharma\"), .sector-selector button >> nth=0");
  await dwell();

  const s2Pages = [
    ["pulse", "Sector pulse, shockwave matrix, and KPI orbs."],
    ["companies", "Company composition and industry breadth."],
    ["rankings", "Leaders and laggards by market or fundamentals."],
    ["lifecycle", "Life-cycle scatter: stage against growth."],
    ["structure", "Market-structure scatter: concentration against margin."],
    ["mece", "MECE map — demand, profit pool, policy, valuation."],
  ];
  for (const [id, note] of s2Pages) {
    await setCaption(page, `Sectoral Analytics · S-2 ${id}`, note);
    await clickIf(page, `#sector-s2-tab-${id}`);
    await sleep(700);
    if (id === "rankings") {
      await clickIf(page, "button:has-text(\"Fundamentals\")");
      await dwell(4000);
      await clickIf(page, "button:has-text(\"Market performance\")");
    }
    await hoverChart(page);
    await dwell(id === "pulse" || id === "lifecycle" || id === "structure" || id === "mece" ? CHART_DWELL_MS : DWELL_MS);
  }

  await setCaption(page, "Sectoral Analytics · S-3 Decision Lab", "Local industry selector is independent of the S-2 filter. Benchmarks, radars, and macro dials.");
  await openSection(page, "s3");
  await clickIf(page, ".decision-lab-sector-selector button:has-text(\"Banking\"), .decision-lab-sector-selector button >> nth=5");
  await dwell(3000);
  const s3Pages = [
    ["benchmarks", "Index race tape and return cards."],
    ["investability", "Investability radar versus the all-sector median."],
    ["pestel", "PESTEL external-environment radar."],
    ["porter", "Porter competitive-pressure radar."],
    ["macro", "Macro trigger dials and distance bars."],
  ];
  for (const [id, note] of s3Pages) {
    await setCaption(page, `Sectoral Analytics · S-3 ${id}`, note);
    await clickIf(page, `#sector-s3-tab-${id}`);
    await sleep(700);
    await hoverChart(page);
    await dwell(CHART_DWELL_MS);
  }
}

async function tourIntelligence(page) {
  await openWorkspace(page, "intelligence", "m1");

  await setCaption(page, "Market Intelligence · M-1 Action Board", "Unfiltered source and evidence actions. No industry dimming here.");
  await openSection(page, "m1");
  await scrollInto(page, "#intelligence-m1 .kanban-board");
  await dwell();

  await setCaption(page, "Market Intelligence · M-2 Live Intelligence", "Newsletters, Axis Research, and Podcasts from the permitted iCloud folders.");
  await openSection(page, "m2");
  await scrollInto(page, "#intelligence-m2");
  await dwell();
  const showAll = page.locator("button:has-text(\"Show all\")");
  const showAllCount = Math.min(await showAll.count(), 3);
  for (let index = 0; index < showAllCount; index += 1) {
    await showAll.nth(index).click().catch(() => undefined);
    await dwell(3500);
  }
  await clickIf(page, "#intelligence-m2 article, #intelligence-m2 .digest-item, #intelligence-m2 button");
  await dwell();

  await setCaption(page, "Market Intelligence · M-3 Earnings Calendar", "The only complete earnings calendar. Select a day to inspect reported versus pending KPIs.");
  await openSection(page, "m3");
  await scrollInto(page, "#intelligence-m3");
  await clickIf(page, ".earnings-month-cell.has-events, .earnings-month-cell.today, .earnings-month-cell");
  await dwell(CHART_DWELL_MS);

  await setCaption(page, "Market Intelligence · M-4 Calendar + Reminders", "Non-earnings calendar plus Completed, Scheduled Important, and Work reminder groups.");
  await openSection(page, "m4");
  await clickIf(page, "[data-feed-section='calendar'] .intelligence-feed-collapse");
  await dwell();
  await clickIf(page, "[data-feed-section='reminders'] .intelligence-feed-collapse");
  await dwell(CHART_DWELL_MS);
}

async function tourBuilder(page) {
  await openWorkspace(page, "builder", "board");

  await setCaption(page, "Algorithm Canvas · B-1 Action Board", "Canonical board for tree-editor work. Nav label is Algorithm Canvas; chrome title is Algorithm Builder.");
  await openSection(page, "board");
  await scrollInto(page, "#builder-board .kanban-board, .kanban-board");
  await dwell();

  await setCaption(page, "Algorithm Canvas · B-2 Canvas", "Details, nested tree, and backtest preview. Live broker tickets stay unsubmitted.");
  await openSection(page, "canvas");
  await scrollInto(page, ".symphony-tree, .builder-canvas");
  await hoverChart(page, ".symphony-tree [data-block-kind], .symphony-tree");
  await dwell(CHART_DWELL_MS);
  await scrollInto(page, ".builder-preview");
  const runButton = page.locator("button:has-text(\"Run backtest\")").first();
  if (await runButton.count() && !(await runButton.isDisabled().catch(() => true))) {
    await runButton.click();
    await sleep(8000);
  }
  await hoverChart(page, ".symphony-curve, .builder-preview");
  await dwell();
  await clickIf(page, "button[data-canvas-advanced='graph']");
  await dwell();
  await clickIf(page, "button[data-canvas-advanced='graph']");

  await setCaption(page, "Algorithm Canvas · B-3 JSON", "Lossless StrategyTreeV1 plus compiled StrategyGraphV2. Apply is left untouched.");
  await openSection(page, "json");
  await scrollInto(page, "textarea, .builder-json");
  await dwell(CHART_DWELL_MS);
}

async function tourStrategies(page) {
  await openWorkspace(page, "strategies", "y1");

  await setCaption(page, "Strategies · Y-1 Action Board", "Library-side daily actions, same three-lane board.");
  await openSection(page, "y1");
  await scrollInto(page, "#strategies-y1 .kanban-board");
  await dwell();

  await setCaption(page, "Strategies · Y-2 Library", "Composer-public trees reconstructed for NSE. Sort, inspect a tree, then open it on the canvas.");
  await openSection(page, "y2");
  await scrollInto(page, "[data-testid='strategies-gallery'], .strategies-gallery");
  await clickIf(page, ".strategies-sort button:has-text(\"Most cumulative\")");
  await dwell(3000);
  await clickIf(page, ".strategies-sort button:has-text(\"Highest Sharpe\")");
  await dwell(3000);
  await clickIf(page, ".strategies-sort button:has-text(\"Most annualized\")");
  await dwell(2000);
  const card = page.locator("[data-testid='strategies-gallery'] [data-testid='strategy-overview-card']").first();
  if (await card.count()) {
    await card.scrollIntoViewIfNeeded({ timeout: 4000 }).catch(() => undefined);
    await card.click({ timeout: 8000 }).catch(() => undefined);
  }
  const dialog = page.locator("[data-testid='strategy-dialog']");
  await dialog.waitFor({ state: "visible", timeout: 8000 }).catch(() => undefined);
  await dwell(CHART_DWELL_MS);
  await scrollInto(page, ".strategy-dialog .read-only-tree, [data-testid='strategy-dialog']");
  await dwell();
  await page.locator("[data-testid='strategy-dialog'] button:has-text(\"Open in Algorithm Canvas\")").click({ timeout: 8000 }).catch(() => undefined);
  await page.waitForURL(/view=builder/, { timeout: 15_000 }).catch(() => undefined);
  await waitReady(page);
  await setCaption(page, "Strategy opened on Algorithm Canvas", "Deep-link loads the selected tree into B-2 without submitting broker actions.");
  await hoverChart(page, ".symphony-tree, .builder-canvas");
  await dwell(CHART_DWELL_MS);
}
