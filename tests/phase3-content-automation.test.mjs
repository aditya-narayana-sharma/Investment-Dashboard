import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  classifyAxisTags,
  classifyNewsletterSentiment,
  podcastTimestampLinks,
  reminderVisual,
  transcriptTextFromTtml,
  yiqTextColor,
} from "../scripts/content-automation.mjs";
import { loadMarketCalendar } from "../scripts/market-calendar-adapter.mjs";
import {
  classifyPodcastInsight,
  configuredPodcastSummarizer,
  deduplicatePodcastEpisodes,
  sanitizeGeneratedInsights,
  sanitizeGeneratedSummary,
  sanitizePodcastTranscript,
  summarizePodcastDescription,
  summarizePodcastTranscript,
} from "../scripts/podcast-summarizer.mjs";
import { findEarningsHolidayConflicts } from "../app/market-calendar.ts";

test("Axis tags are deterministic across sector, thesis, and conviction", () => {
  const tags = classifyAxisTags("Axis Alpha: ICICI Bank BUY after strong loan growth and Q1 earnings beat");
  assert.deepEqual(tags, {
    sector: ["Banking"],
    thesis: ["Earnings", "Growth"],
    conviction: ["High", "Positive"],
  });
  assert.deepEqual(classifyAxisTags("Unclassified research note"), { sector: [], thesis: [], conviction: [] });
});

test("newsletter sentiment uses a conservative deterministic neutral band", () => {
  assert.equal(classifyNewsletterSentiment("Revenue grew and margins beat estimates"), "Positive");
  assert.equal(classifyNewsletterSentiment("Profit fell after a weak quarter"), "Negative");
  assert.equal(classifyNewsletterSentiment("Markets closed after a mixed session"), "Neutral");
});

test("reminder visuals use 50% alpha and YIQ-selected text", () => {
  assert.deepEqual(reminderVisual("Earnings"), {
    topicColor: "#2563EB",
    backgroundColor: "#2563EB80",
    textColor: "#FFF",
  });
  assert.equal(yiqTextColor("#F97316"), "#000");
  assert.equal(yiqTextColor("#000000"), "#FFF");
});

test("TTML transcript cues produce safe episode timestamp links", () => {
  const transcript = transcriptTextFromTtml(`
    <tt><body><div>
      <p begin="00:00:30.000">Revenue growth accelerated in the reported quarter.</p>
      <p begin="01:02:03.000">Management discussed margin expansion and cash flow.</p>
    </div></body></tt>
  `);
  assert.match(transcript, /\[00:00:30\]/);
  const links = podcastTimestampLinks(transcript, "https://podcasts.apple.com/example?i=1");
  assert.equal(links.length, 2);
  assert.equal(links[0].href, "https://podcasts.apple.com/example?i=1#t=0m30s");
  assert.equal(links[1].href, "https://podcasts.apple.com/example?i=1#t=62m3s");
  assert.deepEqual(podcastTimestampLinks(transcript, "javascript:alert(1)"), []);
});

test("podcast summarization covers every transcript chunk end-to-end", async () => {
  const transcript = [
    "[00:00:10] opening-marker introduces the episode thesis and the first major argument with supporting evidence.",
    ...Array.from({ length: 24 }, (_, index) => `[00:${String(index + 1).padStart(2, "0")}:00] section-${index} develops a distinct substantive argument with evidence and a stated conclusion.`),
    "[00:40:00] closing-marker resolves the disagreement and states the final conclusion for listeners.",
  ].join("\n");
  const calls = [];
  const result = await summarizePodcastTranscript(transcript, {
    maxChunkChars: 420,
    model: "test-local-model",
    async generate(prompt, context) {
      calls.push({ prompt, context });
      if (context.phase === "chunk") {
        return JSON.stringify({ bullets: [
          `Chunk ${context.index + 1} captures its major argument and supporting evidence.`,
          `Chunk ${context.index + 1} records the conclusion reached in this section.`,
        ] });
      }
      return JSON.stringify({ bullets: [
        "The episode develops its opening thesis across every section using distinct supporting evidence.",
        "Participants identify a substantive disagreement and compare the competing arguments.",
        "The closing section resolves the debate and states the episode’s final conclusion.",
      ] });
    },
  });
  assert.equal(result.status, "generated");
  assert.ok(result.chunkCount >= 4);
  const chunkInput = calls.filter((call) => call.context.phase === "chunk").map((call) => call.prompt).join("\n");
  assert.match(chunkInput, /opening-marker/);
  assert.match(chunkInput, /section-12/);
  assert.match(chunkInput, /closing-marker/);
  assert.equal(calls.at(-1).context.phase, "synthesis");
  assert.equal(result.bullets.length, 3);
  assert.equal(result.insights.length, 3);
  assert.deepEqual(Object.keys(result.insights[0]).sort(), ["outcome", "sentiment", "text"]);
});

test("podcast insights preserve model labels and classify legacy bullets", () => {
  const insights = sanitizeGeneratedInsights(JSON.stringify({ bullets: [
    {
      text: "Management expects stronger growth as demand recovers across the core market.",
      outcome: "Positive",
      sentiment: "Positive",
    },
    "The speakers remain cautious because downside risks and uncertainty persist.",
  ] }));
  assert.deepEqual(insights[0], {
    text: "Management expects stronger growth as demand recovers across the core market.",
    outcome: "Positive",
    sentiment: "Positive",
  });
  assert.deepEqual(classifyPodcastInsight(insights[1].text), {
    text: insights[1].text,
    outcome: "Negative",
    sentiment: "Negative",
  });
});

test("publisher descriptions can be AI summarized without being labelled transcripts", async () => {
  const result = await summarizePodcastDescription(
    "The episode examines stronger economic growth and improving demand. The speakers also discuss downside risks from inflation and remain cautious about the outlook.",
    {
      model: "test-local-model",
      async generate(_prompt, context) {
        assert.equal(context.phase, "description");
        return JSON.stringify({ bullets: [
          { text: "Economic growth and demand improved across the period under discussion.", outcome: "Positive", sentiment: "Positive" },
          { text: "Inflation creates downside risk and keeps the speakers cautious about the outlook.", outcome: "Negative", sentiment: "Negative" },
        ] });
      },
    },
  );
  assert.equal(result.status, "generated");
  assert.equal(result.bullets.length, 2);
  assert.equal(result.insights[1].sentiment, "Negative");
});

test("podcast sanitizer removes ads, contacts, CTAs, and show boilerplate", () => {
  const sanitized = sanitizePodcastTranscript([
    "[00:00:00] Welcome to the Example Podcast.",
    "[00:00:10] The central bank decision changed the market outlook materially.",
    "[00:01:00] This episode is brought to you by Acme.",
    "[00:01:05] Use code SAVE20 for a free trial.",
    "[00:01:10] Visit https://example.com or email deals@example.com.",
    "[00:01:15] Download our app now.",
    "[00:01:20] Follow us on Instagram and subscribe.",
    "[00:01:25] Limited-time offer ends Friday.",
    "[00:02:00] Back to the evidence: inflation fell while wages remained firm.",
    "[00:30:00] Thanks for listening and follow us next week.",
  ].join("\n"));
  assert.match(sanitized, /central bank decision/);
  assert.match(sanitized, /inflation fell/);
  assert.doesNotMatch(sanitized, /Acme|SAVE20|example\.com|deals@|Download our app|Instagram|subscribe|Thanks for listening/i);

  const generated = sanitizeGeneratedSummary(JSON.stringify({ bullets: [
    "The guests disagree about whether lower inflation can persist without weaker wages.",
    "Sponsor Acme offers listeners a free trial at deals@example.com.",
    "Evidence from the labor market supports a cautious policy conclusion.",
  ] }));
  assert.equal(generated.length, 2);
  assert.doesNotMatch(generated.join(" "), /Acme|example\.com/i);
});

test("podcast sanitizer removes contact-detail CTAs beyond ads and social follows", () => {
  const sanitized = sanitizePodcastTranscript([
    "[00:00:00] Welcome to the Example Podcast.",
    "[00:00:10] The central bank decision changed the market outlook materially.",
    "[00:01:00] WhatsApp us or DM us on Instagram with your questions.",
    "[00:01:05] Call our helpline, it's toll-free, or reach our customer care team.",
    "[00:01:10] Scan the QR code and install the app to book a demo.",
    "[00:01:15] Join our Telegram and Discord communities for more.",
    "[00:02:00] Back to the evidence: inflation fell while wages remained firm.",
  ].join("\n"));
  assert.match(sanitized, /central bank decision/);
  assert.match(sanitized, /inflation fell/);
  assert.doesNotMatch(sanitized, /WhatsApp|DM us|helpline|toll-free|customer care|QR code|install the app|book a demo|Telegram|Discord/i);
});

test("podcast sanitizer strips bare embedded domains from transcript lines", () => {
  const generated = sanitizeGeneratedSummary(JSON.stringify({ bullets: [
    "The host cites data hosted at marketdata.example.com to support the thesis.",
    "Listeners can find the full dataset at research.example.org for further reading.",
  ] }));
  assert.equal(generated.length, 2);
  assert.doesNotMatch(generated.join(" "), /example\.com|example\.org/i);
  assert.match(generated.join(" "), /host cites data|full dataset/i);
});

test("descriptions never become transcript summaries and unavailable stays empty", async () => {
  const result = await summarizePodcastTranscript("", {
    async generate() {
      throw new Error("generator must not run without a transcript");
    },
  });
  assert.equal(result.status, "unavailable");
  assert.equal(result.reason, "transcript_unavailable");
  assert.deepEqual(result.bullets, []);
});

test("podcast deduplication prefers a generated transcript summary by normalized title", () => {
  const items = deduplicatePodcastEpisodes([
    {
      title: "Bonus: The Market Debate",
      contentSource: "none",
      summaryStatus: "unavailable",
      keyTakeaways: [],
    },
    {
      title: "The Market Debate",
      contentSource: "transcript",
      summaryStatus: "generated",
      keyTakeaways: ["Argument one", "Argument two", "Conclusion"],
    },
  ]);
  assert.equal(items.length, 1);
  assert.equal(items[0].summaryStatus, "generated");
});

test("summarizer adapter is local and opt-in by default", () => {
  assert.equal(configuredPodcastSummarizer({}).generate, null);
  assert.equal(configuredPodcastSummarizer({
    PODCAST_SUMMARIZER_MODEL: "local-model",
    PODCAST_SUMMARIZER_URL: "https://paid.example.com/generate",
  }).generate, null);
  assert.equal(typeof configuredPodcastSummarizer({
    PODCAST_SUMMARIZER_MODEL: "local-model",
    PODCAST_SUMMARIZER_URL: "http://127.0.0.1:11434/api/generate",
  }, async () => new Response(JSON.stringify({ response: "{}" }))).generate, "function");
});

test("market calendar accepts only source-attributed rows and detects earnings conflicts", async () => {
  const directory = await mkdtemp(join(tmpdir(), "dashboard-market-calendar-"));
  const path = join(directory, "calendar.json");
  try {
    await writeFile(path, JSON.stringify({
      version: 1,
      asOf: "2026-08-01T00:00:00.000Z",
      coverageStart: "2026-01-01",
      coverageEnd: "2026-12-31",
      sources: {
        NSE: { name: "NSE official", url: "https://www.nseindia.com/resources/exchange-communication-holidays" },
        US: { name: "NYSE official", url: "https://www.nyse.com/markets/hours-calendars" },
      },
      holidays: [
        { market: "NSE", date: "2026-08-15", name: "Independence Day" },
        { market: "US", date: "2027-01-01", name: "Outside active window" },
        { market: "NSE", date: "2026-08-20", name: "Untrusted override", sourceUrl: "http://example.com" },
      ],
    }));
    const snapshot = await loadMarketCalendar({
      path,
      windowStart: "2026-08-01",
      windowEnd: "2026-08-31",
    });
    assert.equal(snapshot.status, "live");
    assert.equal(snapshot.crypto.semantics, "24/7");
    assert.equal(snapshot.holidays.length, 1);

    const conflicts = findEarningsHolidayConflicts(
      [{
        date: "15 Aug",
        day: "15",
        symbol: "TEST",
        name: "Test Co",
        state: "Due",
        portfolio: false,
        period: "Q1",
        reported: false,
        kpis: [],
      }],
      snapshot.holidays,
      "2026-08-06",
    );
    assert.equal(conflicts.length, 1);
    assert.equal(conflicts[0].market, "NSE");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("missing market-calendar configuration stays conservative", async () => {
  const snapshot = await loadMarketCalendar({ path: "", windowStart: "2026-08-01", windowEnd: "2026-08-31" });
  assert.equal(snapshot.status, "unavailable");
  assert.deepEqual(snapshot.holidays, []);
});

test("committed config/market-calendar.json loads as live for the active window", async () => {
  const snapshot = await loadMarketCalendar({
    windowStart: "2026-08-01",
    windowEnd: "2026-09-21",
  });
  assert.equal(snapshot.status, "live");
  assert.equal(snapshot.crypto.semantics, "24/7");
  assert.ok(snapshot.holidays.some((row) => row.marketHoliday?.market === "NSE" && row.title.includes("Ganesh")));
  assert.ok(snapshot.holidays.every((row) => /^https:\/\//.test(row.marketHoliday?.sourceUrl ?? "")));
});
