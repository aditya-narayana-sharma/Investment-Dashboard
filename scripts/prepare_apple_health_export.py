#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import shutil
import zipfile
import xml.etree.ElementTree as ET
from datetime import datetime
from pathlib import Path
from typing import Optional


MEMBER = "apple_health_export/export.xml"


def fingerprint(path: Optional[Path]) -> dict:
    if not path or not path.exists():
        return {}
    stat = path.stat()
    return {"path": str(path), "size": stat.st_size, "mtimeNs": stat.st_mtime_ns}


def state(
    status: str,
    active_archive: Optional[Path],
    rejected_archive: Optional[Path],
    export_xml: Path,
    message: str,
    fallback_reason: str = "",
) -> dict:
    return {
        "status": status,
        "archive": str(active_archive) if active_archive else "",
        "activeArchive": str(active_archive) if active_archive else "",
        "rejectedArchive": str(rejected_archive) if rejected_archive else "",
        "activeArchiveFingerprint": fingerprint(active_archive),
        "rejectedArchiveFingerprint": fingerprint(rejected_archive),
        "fallbackReason": fallback_reason,
        "archiveModifiedAt": (
            datetime.fromtimestamp(active_archive.stat().st_mtime).astimezone().isoformat()
            if active_archive and active_archive.exists()
            else ""
        ),
        "activeExport": str(export_xml),
        "activeExportSize": export_xml.stat().st_size if export_xml.exists() else 0,
        "checkedAt": datetime.now().astimezone().isoformat(),
        "message": message,
    }


def validate_xml(path: Path) -> None:
    root_tag = ""
    export_date_found = False
    try:
        for event, elem in ET.iterparse(path, events=("start", "end")):
            if not root_tag and event == "start":
                root_tag = elem.tag
            if event == "end" and elem.tag == "ExportDate":
                export_date_found = bool(elem.attrib.get("value"))
            if event == "end":
                elem.clear()
    except ET.ParseError as error:
        raise zipfile.BadZipFile(f"{MEMBER} is not well-formed XML: {error}") from error
    if root_tag != "HealthData":
        raise zipfile.BadZipFile(f"{MEMBER} has unexpected root element {root_tag or 'missing'}.")
    if not export_date_found:
        raise zipfile.BadZipFile(f"{MEMBER} does not contain an ExportDate.")


def prepare_archive(archive_path: Path, export_xml: Path) -> str:
    with zipfile.ZipFile(archive_path) as archive:
        info = archive.getinfo(MEMBER)
        needs_extract = (
            not export_xml.exists()
            or export_xml.stat().st_size != info.file_size
            or export_xml.stat().st_mtime_ns < archive_path.stat().st_mtime_ns
        )
        if not needs_extract:
            return "reused"
        export_xml.parent.mkdir(parents=True, exist_ok=True)
        temporary = export_xml.with_name(f".{export_xml.name}.{os.getpid()}.tmp")
        try:
            with archive.open(info) as source, temporary.open("wb") as target:
                shutil.copyfileobj(source, target, length=8 * 1024 * 1024)
            if temporary.stat().st_size != info.file_size:
                raise zipfile.BadZipFile(
                    f"Extracted {temporary.stat().st_size:,} bytes; expected {info.file_size:,}."
                )
            validate_xml(temporary)
            os.replace(temporary, export_xml)
        finally:
            temporary.unlink(missing_ok=True)
    return "extracted"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--health-dir", required=True, type=Path)
    parser.add_argument("--export-xml", required=True, type=Path)
    parser.add_argument("--state", required=True, type=Path)
    args = parser.parse_args()

    archives = sorted(args.health_dir.glob("*.zip"), key=lambda path: path.stat().st_mtime, reverse=True)
    latest = archives[0] if archives else None
    result: dict

    if latest is None:
        if not args.export_xml.exists():
            result = state("unavailable", None, None, args.export_xml, "No Apple Health ZIP or extracted export.xml was found.")
            args.state.parent.mkdir(parents=True, exist_ok=True)
            args.state.write_text(json.dumps(result, indent=2), encoding="utf-8")
            return 1
        result = state("verified_export", None, None, args.export_xml, "No ZIP was found; using the existing validated export.xml.")
    else:
        rejected_archive: Optional[Path] = None
        rejected_reason = ""
        active_archive: Optional[Path] = None
        action = ""
        for index, archive_path in enumerate(archives):
            try:
                action = prepare_archive(archive_path, args.export_xml)
                active_archive = archive_path
                status = "verified_latest" if index == 0 else "cached_fallback"
                fallback_reason = rejected_reason if index else ""
                message = (
                    f"Validated the newest archive and {action} {MEMBER}."
                    if index == 0
                    else f"Newest archive was rejected ({rejected_reason}); retained valid fallback {archive_path.name}."
                )
                result = state(
                    status,
                    active_archive,
                    rejected_archive,
                    args.export_xml,
                    message,
                    fallback_reason,
                )
                break
            except (OSError, KeyError, zipfile.BadZipFile) as error:
                if index == 0:
                    rejected_archive = archive_path
                    rejected_reason = (
                        "ZIP central directory is missing or invalid."
                        if isinstance(error, zipfile.BadZipFile) and "zip file" in str(error).lower()
                        else str(error)
                    )
                continue
        else:
            if not args.export_xml.exists():
                result = state(
                    "unavailable",
                    None,
                    rejected_archive or latest,
                    args.export_xml,
                    f"No valid Apple Health archive or fallback export exists: {rejected_reason or 'archive validation failed'}.",
                    rejected_reason,
                )
                args.state.parent.mkdir(parents=True, exist_ok=True)
                args.state.write_text(json.dumps(result, indent=2), encoding="utf-8")
                return 1
            result = state(
                "invalid_latest",
                None,
                rejected_archive or latest,
                args.export_xml,
                f"Newest archive is invalid ({rejected_reason}); retained the last validated extracted export.xml.",
                rejected_reason,
            )

    args.state.parent.mkdir(parents=True, exist_ok=True)
    args.state.write_text(json.dumps(result, indent=2), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
