export const AXIS_RESEARCH_SENDER = /(?:\baxis\s*(?:direct|securities|research)\b|@(?:[\w.-]+\.)?(?:axisdirect|axissecurities)\.(?:in|com)\b)/i;

/** KYC / contract-note / login / NPS-account promo. Webinars are classified, not dropped. */
export const NON_RESEARCH_SUBJECT = /\b(?:learn account offer|account offer benefits|brokerage plan|contract note|margin statement|ledger statement|fund statement|kyc|otp|password|nominee|demat statement|access code|security alert|new device|log[\s-]?in|nps account|axis direct nps|retirement fund.{0,60}nps|portfolio leak|ultimate flexibility)\b/i;

export function isAxisResearchSender(sender) {
  return AXIS_RESEARCH_SENDER.test(String(sender ?? ""));
}

export function isAxisLiveWebinarSubject(subject) {
  return /\blive\s+webinars?\b|\bwebinar\b/i.test(String(subject ?? ""));
}

export function isNonResearchSubject(subject) {
  const text = String(subject ?? "");
  if (isAxisLiveWebinarSubject(text)) return false;
  return NON_RESEARCH_SUBJECT.test(text);
}

export function isAxisResearchMail(message) {
  const sender = String(message?.sender ?? "");
  const subject = String(message?.subject ?? "");

  return isAxisResearchSender(sender) && !isNonResearchSubject(subject);
}
