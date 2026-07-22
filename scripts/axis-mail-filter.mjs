const AXIS_RESEARCH_SENDER = /(?:\baxis\s*(?:direct|securities|research)\b|@(?:[\w.-]+\.)?(?:axisdirect|axissecurities)\.(?:in|com)\b)/i;

const NON_RESEARCH_SUBJECT = /\b(?:learn account offer|account offer benefits|brokerage plan|contract note|margin statement|ledger statement|fund statement|kyc|otp|password|nominee|demat statement)\b/i;

export function isAxisResearchMail(message) {
  const sender = String(message?.sender ?? "");
  const subject = String(message?.subject ?? "");

  return AXIS_RESEARCH_SENDER.test(sender) && !NON_RESEARCH_SUBJECT.test(subject);
}
