const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export type HealthTargetPolicy = "D_EVENING" | "D_OVERNIGHT" | "D_MINUS_1";

export type HealthTargetContext = {
  targetDate: string;
  policy: HealthTargetPolicy;
  label: string;
};

function shiftDateKey(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Resolve the reporting date in Asia/Kolkata. The Health day advances at
 * 20:00 IST and the overnight D window stays anchored to the prior evening.
 */
export function healthTargetContext(at = new Date()): HealthTargetContext {
  const ist = new Date(at.getTime() + IST_OFFSET_MS);
  const calendarDate = ist.toISOString().slice(0, 10);
  const hour = ist.getUTCHours();

  if (hour >= 20) {
    return { targetDate: calendarDate, policy: "D_EVENING", label: "D · evening cutoff" };
  }
  if (hour < 2) {
    return { targetDate: shiftDateKey(calendarDate, -1), policy: "D_OVERNIGHT", label: "D · overnight window" };
  }
  return { targetDate: shiftDateKey(calendarDate, -1), policy: "D_MINUS_1", label: "D-1" };
}

export function healthTargetDateKey(at = new Date()) {
  return healthTargetContext(at).targetDate;
}

export function healthPolicyLabel(policy: HealthTargetPolicy | undefined) {
  if (policy === "D_EVENING") return "D · evening cutoff";
  if (policy === "D_OVERNIGHT") return "D · overnight window";
  return "D-1";
}
