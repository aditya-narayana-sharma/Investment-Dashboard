#!/usr/bin/env python3
"""Merge a startup-refresh progress event into artifacts/private/startup-progress.json."""
from __future__ import annotations

import json
import os
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

STAGES = [
    "service",
    "kite",
    "calendar",
    "mail",
    "axis",
    "reminders",
    "podcasts",
    "sectors",
    "earnings",
    "health",
    "hydrate",
]
SOURCE_STAGES = [stage for stage in STAGES if stage != "hydrate"]


def progress_paths(root: Path) -> tuple[Path, Path]:
    artifact = Path(os.environ.get(
        "PORTFOLIO_STARTUP_PROGRESS_PATH",
        root / "artifacts" / "private" / "startup-progress.json",
    ))
    log_copy = Path.home() / "Library" / "Logs" / "PortfolioIntelligence" / "startup-progress.json"
    return artifact, log_copy


def percent_from_snapshot(snapshot: dict) -> float:
    completed = set(snapshot.get("completed") or [])
    if "hydrate" in completed:
        return 1.0
    done = sum(1 for stage in SOURCE_STAGES if stage in completed)
    current = snapshot.get("stage")
    try:
        fraction = float(snapshot.get("fraction") or 0)
    except (TypeError, ValueError):
        fraction = 0.0
    in_progress = min(max(fraction, 0.0), 0.99) if current and current != "hydrate" and current not in completed else 0.0
    return round((done + in_progress) / len(STAGES), 4)


def read_snapshot(path: Path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {
            "schemaVersion": 1,
            "stage": "service",
            "state": "start",
            "label": "Starting Stratji…",
            "fraction": 0,
            "completed": [],
            "failed": [],
            "percent": 0,
            "updatedAt": datetime(1970, 1, 1, tzinfo=timezone.utc).isoformat(),
        }


def write_snapshot(path: Path, snapshot: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    encoded = json.dumps(snapshot, indent=2) + "\n"
    fd, tmp = tempfile.mkstemp(prefix=path.name, dir=str(path.parent))
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            handle.write(encoded)
        os.replace(tmp, path)
    except Exception:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise


def merge_progress(current: dict, stage: str, state: str, label: str, fraction: float | None) -> dict:
    if stage == "service" and state in {"start", "ok", "failed"}:
        completed = set() if state == "start" else {"service"}
        failed = {"service"} if state == "failed" else set()
    else:
        completed = set(current.get("completed") or [])
        failed = set(current.get("failed") or [])
        if stage != "service":
            completed.add("service")
        if state in {"ensure", "ensure-failed"}:
            if stage not in completed:
                completed.add(stage)
                if state == "ensure-failed":
                    failed.add(stage)
        elif state in {"ok", "failed"}:
            completed.add(stage)
            if state == "failed":
                failed.add(stage)
            else:
                failed.discard(stage)
    resolved_fraction = 1.0 if state in {"ok", "failed", "ensure", "ensure-failed"} else (0.0 if fraction is None else fraction)
    snapshot = {
        "schemaVersion": 1,
        "stage": stage,
        "state": "failed" if state in {"failed", "ensure-failed"} and stage in failed else (
            "ok" if state in {"ok", "ensure", "ensure-failed"} else state
        ),
        "label": label or current.get("label") or "",
        "fraction": resolved_fraction,
        "completed": [item for item in STAGES if item in completed],
        "failed": [item for item in STAGES if item in failed],
        "updatedAt": datetime.now(timezone.utc).isoformat(),
    }
    snapshot["percent"] = percent_from_snapshot(snapshot)
    return snapshot


def apply_event(root: Path, stage: str, state: str, label: str, fraction: float | None = None) -> dict:
    artifact, log_copy = progress_paths(root)
    snapshot = merge_progress(read_snapshot(artifact), stage, state, label, fraction)
    write_snapshot(artifact, snapshot)
    try:
        write_snapshot(log_copy, snapshot)
    except OSError:
        pass
    return snapshot


def main() -> int:
    if len(sys.argv) < 4:
        print("usage: write-startup-progress.py <repo-root> <stage> <start|ok|failed|ensure> [label] [fraction]", file=sys.stderr)
        return 1
    root = Path(sys.argv[1])
    stage = sys.argv[2]
    state = sys.argv[3]
    label = sys.argv[4] if len(sys.argv) > 4 else ""
    fraction = None
    if len(sys.argv) > 5:
        try:
            fraction = float(sys.argv[5])
        except ValueError:
            label = " ".join(sys.argv[4:])
    apply_event(root, stage, state, label, fraction)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
