import assert from "node:assert/strict";
import test from "node:test";
import {
  DIGEST_BULLET_TARGET,
  digestItemBullets,
  earningsEventBullets,
  extractContentBullets,
  isDigestContentWorthy,
  isDigestPromoOrNoise,
  preferPodcastContentSource,
} from "../app/digest-bullets.ts";

test("extractContentBullets splits numbered and sentence content into multiple points", () => {
  const text = [
    "1) President Trump said he’s considering a massive attack on Iran.",
    "2) The US will collect duties of between 10% and 12.5% on imports.",
    "3) Mag 7 stocks lost about $797B after the tariff reboot.",
    "4) Brent crude rose above $100 a barrel before dropping slightly.",
    "5) Barclays is hunting for growth in investment banking.",
  ].join("\n");
  const bullets = extractContentBullets(text);
  assert.ok(bullets.length >= DIGEST_BULLET_TARGET, `expected ≥${DIGEST_BULLET_TARGET}, got ${bullets.length}`);
});

test("digestItemBullets for mail keeps content takeaways and rejects provenance padding", () => {
  const bullets = digestItemBullets({
    title: "Daily Morning Note",
    source: "Axis Direct",
    time: "8:51 AM",
    summary: [
      "Nifty closed lower amid weak global cues and thin breadth.",
      "Breadth stayed weak across mid-caps with more declines than advances.",
      "Banking names led the selloff while IT held relatively better.",
      "Foreign flows remained net sellers for a third session.",
      "Crude stayed elevated and kept energy names in focus.",
    ].join(" "),
    bullets: [
      "Headline: Daily Morning Note",
      "Source: Axis Direct",
      "Nifty closed lower amid weak global cues and thin breadth.",
      "Breadth stayed weak across mid-caps with more declines than advances.",
    ],
    kind: "mail",
  });
  assert.ok(bullets.length >= 2);
  assert.ok(bullets.every((item) => !/^(Headline|Source|As of|Show|Received|Calendar|Topic|Starts|Ends):/i.test(item)));
  assert.ok(bullets.some((item) => /Nifty|Breadth/i.test(item)));
  assert.doesNotMatch(bullets.join(" "), /fabricated|guaranteed upside/i);
});

test("digestItemBullets does not invent provenance fillers when body is thin", () => {
  const bullets = digestItemBullets({
    title: "Short note",
    source: "Newsletter",
    time: "9:00 AM",
    summary: "Markets mixed.",
    kind: "mail",
  });
  assert.ok(bullets.length < DIGEST_BULLET_TARGET);
  assert.ok(bullets.every((item) => !/^(Headline|Source|As of):/i.test(item)));
});

test("digestItemBullets returns no bullets for calendar and reminders", () => {
  assert.deepEqual(
    digestItemBullets({
      title: "Ashadha Puja",
      calendar: "Indian Holidays",
      topic: "Personal",
      startsAt: "2026-07-01T00:00:00+05:30",
      kind: "calendar",
    }),
    [],
  );
  assert.deepEqual(
    digestItemBullets({
      title: "HVAC Engineer",
      list: "Job 🔍",
      topic: "Other",
      kind: "reminder",
    }),
    [],
  );
});

test("earningsEventBullets prefers narrative summary and contextual KPI lines without calendar meta", () => {
  const bullets = earningsEventBullets({
    symbol: "LTF",
    name: "L&T Finance",
    date: "10 Jul",
    period: "Q1 FY27",
    state: "Reported",
    reported: true,
    portfolio: false,
    summary: "Highest-ever quarterly PAT was delivered as disbursements reached ₹23,852 crore.",
    source: "https://www.ltfinance.com/example.pdf",
    kpis: [
      { label: "PAT", value: "₹902 Cr", change: "+29% YoY" },
      { label: "Loan book", value: "₹1,29,634 Cr", change: "+27% YoY" },
      { label: "Return on assets", value: "2.48%", change: "+11 bps YoY" },
      { label: "Credit cost", value: "", change: "" },
    ],
  });
  assert.ok(bullets.length >= DIGEST_BULLET_TARGET);
  assert.ok(bullets.some((item) => /PAT printed at ₹902 Cr/i.test(item)));
  assert.ok(bullets.some((item) => /Highest-ever quarterly PAT|disbursements reached/i.test(item)));
  assert.ok(!bullets.some((item) => /Credit cost:/i.test(item)));
  assert.ok(!bullets.some((item) => /^(Schedule|Status|Source|Marked):/i.test(item)));
  assert.doesNotMatch(bullets.join(" "), /ltfinance\.com|current holding/i);
});

test("isDigestPromoOrNoise catches podcast CTA and follow/subscribe plugs", () => {
  const promos = [
    "Follow Joe Weisenthal on Twitter @TheStalwart and Tracy Alloway @tracyalloway.",
    "Check out the Odd Lots transcript at Bloomberg.com/podcasts.",
    "See more about this episode at bloomberg.com/oddlots.",
    "Subscribe to The Daily on Apple Podcasts or Spotify.",
    "Learn more about your ad choices. Visit podcastchoices.com/adchoices",
    "Support Planet Money and hear every episode without ads by subscribing to Planet Money+.",
    "Follow us on TikTok, Instagram, and Twitter @planetmoney.",
    "Read a transcript of this episode on FT.com",
    "Hosted on Acast. See acast.com/privacy for more information.",
    "Catch the latest episode of ‘The Morning Brief’ on Spotify and Youtube.",
    "For access to future livestreams, you can subscribe to our substack here.",
    "Send us your questions or comments by emailing Markets@profgmedia.com",
    "Put your email here and we'll make you smart every day",
    "Note: This content is for informational purposes only. None of the stocks mentioned are recommendations.",
    "00:04 Intro 00:25 Reliance FY27 Q1 13:01 TRAI vs Truecaller",
    "Mentioned in this podcast:",
    "Axis Direct brings you global markets with zero entry barriers.",
    "Your international portfolio is waiting.",
    "Registered Office Address - Axis Securities Ltd., Unit 002(A), Mumbai",
    "Share this email Brought to you by Ruth Heuss",
    "Fable at half price? HELLYEAH",
    "It's out already bruh",
  ];
  for (const line of promos) {
    assert.equal(isDigestPromoOrNoise(line), true, `expected promo: ${line}`);
  }
  assert.equal(
    isDigestPromoOrNoise("Ed Elson and Scott Galloway discuss AI dumping risks with Noah Smith."),
    false,
  );
});

test("isDigestContentWorthy rejects emails, irregular fragments, and bare names", () => {
  assert.equal(isDigestContentWorthy("Contact editors@example.com for the full note."), false);
  assert.equal(isDigestContentWorthy("m@growthschoOkay no seriously, I am writing this tonight."), false);
  assert.equal(isDigestContentWorthy("Rain Industries Ltd."), false);
  assert.equal(isDigestContentWorthy("Red flags to watch out for:"), false);
  assert.equal(
    isDigestContentWorthy("Nifty closed lower amid weak global cues and thin breadth across the tape."),
    true,
  );
});

test("digest cleaning removes Indian phone numbers and embedded ad bullets", () => {
  const bullets = extractContentBullets([
    "Brent crude rose to $94 as shipping risk increased near Hormuz.",
    "For help call +91 98765 43210.",
    "What's the real return on Slack? See the ROI data.",
    "A Forrester Total Economic Impact study says users made their money back in six months.",
  ].join("\n"));
  assert.ok(bullets.some((item) => /Brent crude|Hormuz/i.test(item)));
  assert.doesNotMatch(bullets.join(" "), /98765|Slack|Forrester|money back/i);
});

test("podcast digest bullets drop CTAs and do not pad to five with promo", () => {
  const description = [
    "Ed Elson and Scott Galloway are joined by Noah Smith to discuss AI issues that deserve more attention.",
    "They explore whether a sovereign wealth fund could help address wealth inequality.",
    "They also cover what America's fertility decline could mean for the economy.",
    "For access to future livestreams, you can subscribe to our substack here.",
    "Subscribe to the Prof G Markets Youtube Channel",
    "Check out our latest Prof G Markets newsletter",
    "Follow Prof G Markets on Instagram",
    "Follow Ed on Instagram, X and Substack",
    "Learn more about your ad choices. Visit podcastchoices.com/adchoices",
  ].join("\n\n");

  const bullets = digestItemBullets({
    title: "America’s Economy Is Entering a New Era — ft. Noah Smith",
    source: "Prof G Markets",
    summary: description,
    bullets: [
      "Ed Elson and Scott Galloway are joined by Noah Smith to discuss AI issues that deserve more attention.",
      "Follow Prof G Markets on Instagram",
      "Check out our latest Prof G Markets newsletter",
      "Subscribe to the Prof G Markets Youtube Channel",
      "See more about this episode on the website.",
    ],
    kind: "podcast",
  });

  assert.ok(bullets.length >= 2);
  assert.ok(bullets.length < DIGEST_BULLET_TARGET, `must not pad with promo; got ${bullets.length}: ${bullets.join(" | ")}`);
  assert.ok(bullets.every((item) => !isDigestPromoOrNoise(item)));
  assert.doesNotMatch(bullets.join(" "), /follow|subscribe|check out|learn more|^see\b|instagram|youtube|substack/i);
  assert.ok(bullets.some((item) => /Noah Smith|sovereign wealth|fertility/i.test(item)));
});

test("preferPodcastContentSource prefers transcripts and falls back to sanitized descriptions", () => {
  assert.equal(
    preferPodcastContentSource("Host discusses tariff policy and oil supply risks in depth today.", "Follow us on Twitter").source,
    "transcript",
  );
  assert.equal(
    preferPodcastContentSource("", "Oil hits $100 and drives a global bond sell-off amid Middle East risk.").source,
    "description",
  );
  assert.doesNotMatch(
    preferPodcastContentSource("", "Oil rose as supply tightened. Follow us on Twitter for more updates.").text,
    /follow|twitter/i,
  );
  assert.equal(preferPodcastContentSource("", "").source, "none");
});

test("digest cleaning rejects navigation, archive promos, and helpdesk residue", () => {
  const promos = [
    "Explore more of McKinsey's latest research.",
    "MISSED LAST WEEK'S FEATURED CHART?",
    "Get our latest thinking on your mobile device.",
    "Helpdesk co-ordinates are available for account queries.",
    "BOOKS AND RESOURCES Inquire about the author's masterclass.",
    "NEW TO THE SHOW? Get smarter through the Intrinsic Value Newsletter.",
    "Try our tool for picking stock winners and managing portfolios.",
    "Enjoy exclusive perks from our favorite apps and services.",
    "McKinsey & Company, 3 World Trade Center, 175 Greenwich Street, New York, NY 10007",
    "TLDR subscribers actively choose to open their inbox daily, making it a different ad channel.",
    "Every subscriber has already opted into tech coverage, so there's no wasted reach.",
  ];
  for (const line of promos) {
    assert.equal(isDigestPromoOrNoise(line), true, `expected promo: ${line}`);
  }
});

test("digest cleaning strips international/US-style phone numbers, not just Indian mobiles", () => {
  const bullets = extractContentBullets([
    "Brent crude rose to $94 as shipping risk increased near Hormuz.",
    "For support call +1 (555) 123-4567 any time.",
    "Our toll-free desk answers at 800-555-0199 during market hours.",
    "Reach the helpdesk on +44 20 7946 0958 for account queries.",
  ].join("\n"));
  assert.ok(bullets.some((item) => /Brent crude|Hormuz/i.test(item)));
  assert.doesNotMatch(bullets.join(" "), /555.?123.?4567|800.?555.?0199|7946.?0958/);
});

test("digest cleaning strips bare website domains embedded mid-sentence, not only full URLs", () => {
  const bullets = extractContentBullets([
    "Nifty closed lower amid weak global cues and thin breadth across the tape.",
    "The full data set is hosted at marketdata.example.com for reference.",
    "Analysts at research.example.org flagged a widening credit spread this week.",
  ].join("\n"));
  assert.ok(bullets.some((item) => /Nifty closed lower/i.test(item)));
  assert.doesNotMatch(bullets.join(" "), /example\.com|example\.org/i);
});

test("isDigestPromoOrNoise catches contact-detail CTAs beyond follow/subscribe", () => {
  const promos = [
    "WhatsApp us on our support line for a callback.",
    "DM us on Instagram if you have questions about this pick.",
    "Call our helpline for a free portfolio review today.",
    "Our customer care team is available toll-free around the clock.",
    "Scan the QR code to download the app and start investing.",
    "Join our Telegram and Discord for daily alpha.",
    "Book a demo with our advisory team this week.",
  ];
  for (const line of promos) {
    assert.equal(isDigestPromoOrNoise(line), true, `expected promo: ${line}`);
  }
});

test("legitimate content with number ranges and financial figures survives new phone/domain filters", () => {
  const bullets = extractContentBullets([
    "Management guided for 2024-2025 revenue growth of 12 to 15 percent.",
    "The company reported PAT of ₹902 Cr, up 29% YoY for Q1 FY27.",
    "Loan book expanded to ₹1,29,634 Cr with return on assets at 2.48%.",
  ].join("\n"));
  assert.ok(bullets.some((item) => /2024-2025|guided for/i.test(item)));
  assert.ok(bullets.some((item) => /PAT of.*902/i.test(item)));
  assert.ok(bullets.some((item) => /Loan book|1,29,634/i.test(item)));
});

test("extractContentBullets from transcript prefers spoken content over description CTAs", () => {
  const transcript = [
    "Oil prices jumped above one hundred dollars a barrel after fresh strikes near Hormuz.",
    "Bond markets sold off as traders priced sticky energy inflation.",
    "Equity futures were mixed with energy names higher and rate-sensitive stocks lower.",
  ].join(" ");
  const description = [
    "A short show note.",
    "Follow @FT on Twitter for more updates.",
    "Subscribe to the Behind the Money newsletter at ft.com.",
    "Check out more FT podcasts at ft.com/podcasts.",
  ].join("\n");
  const preferred = preferPodcastContentSource(transcript, description);
  assert.equal(preferred.source, "transcript");
  const bullets = extractContentBullets(preferred.text);
  assert.ok(bullets.length >= 2);
  assert.doesNotMatch(bullets.join(" "), /follow|subscribe|check out/i);
  assert.ok(bullets.some((item) => /oil|Hormuz|bond/i.test(item)));
});
