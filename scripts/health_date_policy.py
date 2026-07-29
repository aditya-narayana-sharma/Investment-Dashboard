from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo


IST = ZoneInfo("Asia/Kolkata")


@dataclass(frozen=True)
class HealthTargetContext:
    target_date: date
    policy: str
    label: str


def health_target_context(moment: datetime) -> HealthTargetContext:
    local = moment.astimezone(IST)
    if local.hour >= 20:
        return HealthTargetContext(local.date(), "D_EVENING", "D · evening cutoff")
    if local.hour < 2:
        return HealthTargetContext(local.date() - timedelta(days=1), "D_OVERNIGHT", "D · overnight window")
    return HealthTargetContext(local.date() - timedelta(days=1), "D_MINUS_1", "D-1")


def health_target_date(moment: datetime) -> date:
    return health_target_context(moment).target_date


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--at", help="ISO-8601 timestamp; defaults to now")
    parser.add_argument("--date-only", action="store_true")
    args = parser.parse_args()
    instant = datetime.fromisoformat(args.at) if args.at else datetime.now(IST)
    context = health_target_context(instant)
    if args.date_only:
        print(context.target_date.isoformat())
    else:
        print(json.dumps({
            "targetDate": context.target_date.isoformat(),
            "targetPolicy": context.policy,
            "targetLabel": context.label,
        }, ensure_ascii=False))
