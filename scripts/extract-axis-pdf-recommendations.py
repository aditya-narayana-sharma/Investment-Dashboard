#!/usr/bin/env python3
"""Extract Axis BUY/HOLD/SELL + TP + CMP from the local Axis Research PDF archive.

Writes artifacts/private/axis-pdf-recommendations.json for the content-digest merge.
Does not invent calls: only text-layer patterns and filename cues. Image-only pages
without extractable call text are reported as skipped.
"""

from __future__ import annotations

import json
import re
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

try:
    import fitz  # pymupdf
except ImportError as exc:  # pragma: no cover
    raise SystemExit(
        "pymupdf is required. Install into .venv-flask: pip install pymupdf"
    ) from exc

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_ARCHIVE = Path.home() / "Downloads" / "Axis Research"
OUTPUT = ROOT / "artifacts" / "private" / "axis-pdf-recommendations.json"

# Scratch / invalid / non-report artifacts that are not Axis research calls.
SKIP_NAME_RE = re.compile(
    r"(?:^_try|_tryx|copy\.pdf$|Investment_Brief|Newsletter_Digest|Watchlist_|Icon$|"
    r"market-tracker|Combined-May-Jun|RBIMonetary|AutoMonthly|MonthlyQuant|"
    r"DerivativeLens|DailyDerivative|DailyAnalysis|SectorSeasonality|NiftyOption|"
    r"WeeklyOption|WeeklyDerivatives|MonthlyAutoMonitor|TCI-|Seasonality)",
    re.I,
)

COMPANY_SYMBOLS: list[tuple[str, str]] = [
    ("ICICI Bank", "ICICIBANK"),
    ("Bharti Airtel", "BHARTIARTL"),
    ("Eternal", "ETERNAL"),
    ("JSW Energy", "JSWENERGY"),
    ("Adani Green Energy", "ADANIGREEN"),
    ("Aether Industries", "AETHER"),
    ("L&T Finance", "LTF"),
    ("LT Finance", "LTF"),
    ("Tech Mahindra", "TECHM"),
    ("L&T Technology Services", "LTTS"),
    ("LTIMindtree", "LTIM"),
    ("Avenue Supermarts", "DMART"),
    ("R Systems International", "RSYSTEMS"),
    ("R Systems", "RSYSTEMS"),
    ("Ujjivan Small Finance Bank", "UJJIVANSFB"),
    ("Axis Bank", "AXISBANK"),
    ("Global Health", "MEDANTA"),
    ("Bandhan Bank", "BANDHANBNK"),
    ("Max Healthcare", "MAXHEALTHCARE"),
    ("Bajaj Auto", "BAJAJ-AUTO"),
    ("Bharat Petroleum", "BPCL"),
    ("UltraTech Cement", "ULTRACEMCO"),
    ("Steel Strips Wheels", "SSWL"),
    ("Wipro", "WIPRO"),
    ("Star Cement", "STARCEMENT"),
    ("Gujarat Fluorochemicals", "FLUOROCHEM"),
    ("Aptus Value Housing Finance India", "APTUS"),
    ("Rainbow Children's Medicare", "RAINBOW"),
    ("Rainbow Children's", "RAINBOW"),
    ("Tata Consultancy Services", "TCS"),
    ("DLF", "DLF"),
    ("CDSL", "CDSL"),
    ("Kalyani Steels", "KSL"),
    ("Indian Hotels Company", "INDHOTEL"),
    ("Indian Hotels", "INDHOTEL"),
    ("J K Cement", "JKCEMENT"),
    ("JK Cement", "JKCEMENT"),
    ("Can Fin Homes", "CANFINHOME"),
    ("Navin Fluorine International", "NAVINFLUOR"),
    ("Navin Fluorine", "NAVINFLUOR"),
    ("Oberoi Realty", "OBEROIRLTY"),
    ("RITES", "RITES"),
    ("Cholamandalam", "CHOLAFIN"),
    ("Dalmia Bharat", "DALBHARAT"),
    ("Coal India", "COALINDIA"),
    ("NTPC", "NTPC"),
    ("Mold-Tek Packaging", "MOLDTKPAC"),
    ("Mold Tek Packaging", "MOLDTKPAC"),
    ("V-Mart Retail", "VMART"),
    ("V Mart Retail", "VMART"),
    ("Gujarat Fluorochemicals", "FLUOROCHEM"),
    ("Kalyani Steel", "KSL"),
    ("Central Depository Services", "CDSL"),
    ("Dr. Lal PathLabs", "LALPATHLAB"),
    ("Dr Lal PathLabs", "LALPATHLAB"),
    ("Rain Industries", "RAIN"),
    ("H.G. Infra", "HGINFRA"),
    ("HG Infra", "HGINFRA"),
    ("Dhanuka Agritech", "DHANUKA"),
    ("Camlin Fine", "CAMLINFINE"),
    ("Birla Corporation", "BIRLACORPN"),
    ("Birla Corp", "BIRLACORPN"),
    ("HDFC Bank", "HDFCBANK"),
    ("Kotak Mahindra Bank", "KOTAKBANK"),
    ("State Bank of India", "SBIN"),
    ("Federal Bank", "FEDERALBNK"),
    ("Bajaj Finance", "BAJFINANCE"),
    ("Shriram Finance", "SHRIRAMFIN"),
    ("CreditAccess Grameen", "CREDITACC"),
    ("Credit Access Grameen", "CREDITACC"),
    ("Eicher Motors", "EICHERMOT"),
    ("Maruti Suzuki", "MARUTI"),
    ("Endurance Technologies", "ENDURANCE"),
    ("Minda Corporation", "MINDACORP"),
    ("UNO Minda", "UNOMINDA"),
    ("Persistent Systems", "PERSISTENT"),
    ("Coforge", "COFORGE"),
    ("Nestle India", "NESTLEIND"),
    ("Kalpataru Projects", "KPIL"),
    ("Kalpataru", "KPIL"),
    ("APL Apollo", "APLAPOLLO"),
    ("Chalet Hotels", "CHALET"),
    ("Manappuram Finance", "MANAPPURAM"),
    ("LG Electronics India", "LGEINDIA"),
    ("Greenply Industries", "GREENPLY"),
    ("Arvind SmartSpaces", "ARVSMART"),
    ("Prestige Estates", "PRESTIGE"),
    ("Varun Beverages", "VBL"),
    ("Aarti Industries", "AARTIIND"),
    ("Astral", "ASTRAL"),
    ("CCL Products", "CCL"),
    ("Cera Sanitaryware", "CERA"),
    ("Elecon", "ELECON"),
    ("Shriram Pistons", "SHRIPISTON"),
]

FILENAME_COMPANY_RE = re.compile(
    r"Axis[_-]?(?P<company>[A-Za-z0-9]+)-(?P<kind>ResultUpdate|AxisPunch|PickOfWeek|CompanyUpdate|AnnualAnalysis)",
    re.I,
)
LEGACY_RESULT_RE = re.compile(
    r"^(?P<company>[A-Za-z0-9]+)-ResultUpdate-",
    re.I,
)

CALL_RE = re.compile(
    r"\b(?P<call>BUY|HOLD|SELL|REDUCE|ADD|TRADING BUY|TECHNICAL BUY)\b",
    re.I,
)
TP_RE = re.compile(
    r"(?:Current\s+TP|TP|target\s+price)\s*(?:of|:)?\s*(?:Rs\.?|₹|INR)?\s*([\d,]+(?:\.\d+)?)\s*(?:/share|/Share)?",
    re.I,
)
CMP_INLINE_RE = re.compile(
    r"\bCMP\s*(?:\(Rs\.?\))?\s*(?::|of)?\s*(?:Rs\.?|₹|INR)?\s*([\d,]+(?:\.\d+)?)",
    re.I,
)
HORIZON_RE = re.compile(r"Time horizon:\s*([^\n|]+)", re.I)
TECH_BLOCK_RE = re.compile(
    r"CMP:\s*(?P<cmp>[\d,]+)\s*"
    r"Buy Range:\s*(?P<br>[\d,\.\-–]+)\s*"
    r"Stop loss:\s*(?P<sl>[\d,]+)\s*"
    r"Upside:\s*(?P<up>[^\n]+)\s+"
    r"(?P<name>[A-Z][^\n]{2,90}?(?:Ltd\.?|Limited|Labs\.?))\s*",
    re.I,
)
TECH_TARGET_RE = re.compile(
    r"upside toward\s*([\d,]+(?:\.\d+)?)\s*[-–to]+\s*([\d,]+(?:\.\d+)?)\s*levels",
    re.I,
)
CLOSED_RE = re.compile(
    r"target achieved|book profits|hit stop loss|call closure|closed the call",
    re.I,
)
TARGET_ACHIEVED_RE = re.compile(r"target achieved|book(?:ed)? profits?|closed \+?\d+(?:\.\d+)?%", re.I)
ACHIEVEMENT_NAME_RE = re.compile(
    r"(?:\*+)?(?P<name>[A-Z][A-Za-z0-9 &.'-]{1,70}?)(?:\s*\([^)]*\))?\s*(?:\|\s*)?"
    r"(?:target achieved|book(?:ed)?\s*\+?\d+(?:\.\d+)?%|book profits?)",
    re.I,
)
DATE_IN_NAME_RE = re.compile(r"(20\d{2})-(\d{2})-(\d{2})")
DATE_LEGACY_RE = re.compile(r"(\d{2})(\d{2})(20\d{2})")


def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def parse_number(raw: str | None) -> float | None:
    if not raw:
        return None
    try:
        return float(str(raw).replace(",", ""))
    except ValueError:
        return None


def recommendation_symbol(name: str) -> str:
    normalized = re.sub(r"\s+(?:Ltd|Limited|Company)\.?$", "", clean_text(name), flags=re.I).strip()
    if not normalized:
        return "UNKNOWN"
    right = normalized.lower()
    # Prefer longer company aliases to avoid Rain→Rainbow / short substring traps.
    for company, symbol in sorted(COMPANY_SYMBOLS, key=lambda row: len(row[0]), reverse=True):
        left = company.lower()
        if re.search(rf"(?<![a-z0-9]){re.escape(left)}(?![a-z0-9])", right):
            return symbol
        if len(right) >= 5 and re.search(rf"(?<![a-z0-9]){re.escape(right)}(?![a-z0-9])", left):
            return symbol
    slug = re.sub(r"[^A-Z0-9-]", "", normalized.upper())
    return slug[:14] or "UNKNOWN"


def camel_to_words(token: str) -> str:
    spaced = re.sub(r"(?<=[a-z])(?=[A-Z])", " ", token)
    spaced = re.sub(r"(?<=[A-Z])(?=[A-Z][a-z])", " ", spaced)
    return clean_text(spaced)


def classify_doc(path: Path, text: str) -> str:
    name = path.name
    lower = f"{name} {text[:800]}".lower()
    if "weeklytechnicalpicks" in name.lower() or "weekly technical" in lower and "buy range" in lower:
        return "technical"
    if "axispunch" in name.lower() or "axis punch" in lower:
        return "trading"
    if "technicaloutlook" in name.lower() or "dailytechnical" in name.lower():
        return "technical-market"
    if "morningnote" in name.lower() or "morning-note" in name.lower() or "morning note" in lower:
        return "morning"
    if any(k in name.lower() for k in ("resultupdate", "pickofweek", "companyupdate", "annualanalysis", "top-picks", "top_picks")):
        return "fundamental"
    if "top picks" in lower:
        return "fundamental"
    return "other"


def date_from_path(path: Path) -> str | None:
    m = DATE_IN_NAME_RE.search(path.name)
    if m:
        return f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
    m = DATE_LEGACY_RE.search(path.name)
    if m:
        return f"{m.group(3)}-{m.group(2)}-{m.group(1)}"
    # mtime fallback as ISO date (local)
    try:
        return datetime.fromtimestamp(path.stat().st_mtime).date().isoformat()
    except OSError:
        return None


def format_display_date(date_key: str | None) -> str:
    if not date_key:
        return "Axis PDF"
    try:
        dt = datetime.strptime(date_key, "%Y-%m-%d")
        return dt.strftime("%-d %b").lstrip() if sys.platform != "darwin" else dt.strftime("%-d %b")
    except ValueError:
        return date_key


def company_from_filename(path: Path) -> tuple[str | None, str | None]:
    m = FILENAME_COMPANY_RE.search(path.name)
    if m:
        words = camel_to_words(m.group("company"))
        return words, recommendation_symbol(words)
    m = LEGACY_RESULT_RE.search(path.name)
    if m:
        words = camel_to_words(m.group("company"))
        return words, recommendation_symbol(words)
    return None, None


CMP_TABLE_RE = re.compile(
    r"CMP\s*\(Rs\.?\)\s*([\d,]+(?:\.\d+)?)",
    re.I,
)
CMP_LABEL_NEXT_RE = re.compile(
    r"CMP\s*\(Rs\.?\)\s*(?:\n|\r\n?|\s)+([\d,]+(?:\.\d+)?)",
    re.I,
)


def extract_cmp_near_tp(text: str) -> float | None:
    # Prefer table-style CMP (Rs) values; avoid Nifty index CMPs.
    for pattern in (CMP_TABLE_RE, CMP_LABEL_NEXT_RE, CMP_INLINE_RE):
        for m in pattern.finditer(text):
            value = parse_number(m.group(1))
            if value is None:
                continue
            if 5 <= value <= 20000:
                return value
    return None


def source_rank(item: dict) -> tuple:
    """Prefer dedicated company notes with CMP/TP over morning-note digests."""
    name = (item.get("sourceFile") or "").lower()
    dedicated = 0
    if any(token in name for token in ("resultupdate", "axispunch", "pickofweek", "companyupdate", "annualanalysis", "weeklytechnical")):
        dedicated = 2
    elif "top-picks" in name or "top_picks" in name:
        dedicated = 1
    has_cmp = 1 if item.get("cmp") else 0
    has_target = 1 if item.get("target") else 0
    return (dedicated, has_cmp, has_target, item.get("dateKey") or "")


def extract_fundamental_from_text(
    path: Path,
    text: str,
    *,
    forced_name: str | None,
    forced_symbol: str | None,
    doc_kind: str,
) -> list[dict]:
    if CLOSED_RE.search(path.name) or CLOSED_RE.search(text[:500]):
        return []

    findings: list[dict] = []
    horizon_match = HORIZON_RE.search(text)
    horizon = clean_text(horizon_match.group(1)) if horizon_match else None
    if not horizon:
        if doc_kind == "trading":
            horizon = "Axis Punch"
        elif "pickofweek" in path.name.lower():
            horizon = "Pick of the Week"
        elif "resultupdate" in path.name.lower() or "Result Update" in text[:400]:
            horizon = "Result update"
        elif "annual" in path.name.lower():
            horizon = "Annual analysis"
        elif "top-picks" in path.name.lower() or "Top Picks" in text[:400]:
            horizon = "Axis Top Picks"
        else:
            horizon = "Axis PDF report"

    # Single-company report: filename + first TP + recommendation-context call.
    head = text[:6000]
    tp_match = TP_RE.search(head)
    call = None
    for pattern in (
        re.compile(
            r"(?:maintain(?:s|ed)?(?:\s+our)?|recommend(?:\s+a)?|rating(?:\s+of)?)\s+"
            r"(BUY|HOLD|SELL|REDUCE|ADD|TRADING BUY|TECHNICAL BUY)\b",
            re.I,
        ),
        re.compile(
            r"\b(BUY|HOLD|SELL|REDUCE|ADD|TRADING BUY|TECHNICAL BUY)\b\s*(?:\n|\r\n?|\s)+Target Price",
            re.I,
        ),
        CALL_RE,
    ):
        match = pattern.search(head)
        if not match:
            continue
        call = match.group(1).upper()
        if call in {"HOLD", "SELL"} and forced_name and tp_match:
            if re.search(r"(?:maintain|recommend|rating).{0,24}\bBUY\b", head, re.I) or re.search(
                r"\bBUY\b\s*(?:\n|\r\n?|\s)+Target Price", head, re.I
            ):
                call = "BUY"
        break
    if forced_name and forced_symbol and call and tp_match:
        if call in {"BUY", "HOLD", "SELL", "REDUCE", "ADD", "TRADING BUY", "TECHNICAL BUY"}:
            bucket = (
                "trading"
                if doc_kind == "trading" or "TRADING" in call
                else ("technical" if "TECHNICAL" in call else "fundamental")
            )
            findings.append(
                {
                    "name": forced_name,
                    "symbol": forced_symbol,
                    "call": "TRADING BUY" if doc_kind == "trading" and call == "BUY" else call,
                    "target": parse_number(tp_match.group(1)),
                    "cmp": extract_cmp_near_tp(head),
                    "horizon": horizon,
                    "bucket": bucket,
                }
            )
            return findings

    # Morning notes list many names without reliable per-name TPs — skip loose multi-name / TOC parse.
    if doc_kind == "morning" or re.search(r"morning.?note", path.name, re.I):
        return findings

    # Multi-name Top Picks / digest style: Company … BUY … TP (tight window only).
    for company, symbol in COMPANY_SYMBOLS:
        if any(item["symbol"] == symbol for item in findings):
            continue
        escaped = re.escape(company)
        pattern = re.compile(
            rf"{escaped}(?:\s+(?:Ltd|Limited|Company(?:\s+Ltd)?))?[^.\n]{{0,120}}?"
            rf"\b(BUY|HOLD|SELL|REDUCE|ADD)\b[^.\n]{{0,80}}?"
            rf"(?:TP|target\s+price)\s*(?:of|:)?\s*(?:Rs\.?|₹|INR)?\s*([\d,]+)",
            re.I,
        )
        match = pattern.search(text)
        if not match:
            idx = text.lower().find(company.lower())
            if idx < 0:
                continue
            window = text[idx : idx + 220]
            call_m = CALL_RE.search(window)
            tp_m = TP_RE.search(window)
            if not call_m or not tp_m:
                continue
            call = call_m.group(1).upper() if call_m.lastindex else call_m.group("call").upper()
            target = parse_number(tp_m.group(1))
        else:
            call = match.group(1).upper()
            target = parse_number(match.group(2))
        if not target or target <= 0:
            continue
        findings.append(
            {
                "name": company,
                "symbol": symbol,
                "call": call,
                "target": target,
                "cmp": extract_cmp_near_tp(
                    text[max(0, text.lower().find(company.lower())) : text.lower().find(company.lower()) + 500]
                ),
                "horizon": horizon,
                "bucket": "fundamental",
            }
        )
    return findings


def extract_technical_picks(path: Path, text: str) -> list[dict]:
    findings = []
    for block in TECH_BLOCK_RE.finditer(text):
        name = clean_text(block.group("name")).rstrip(".")
        if re.search(r"Nifty|Bank Nifty|Index|Disclaimer", name, re.I):
            continue
        cmp = parse_number(block.group("cmp"))
        after = re.sub(r"\s+", " ", text[block.end() : block.end() + 1200])
        target_m = TECH_TARGET_RE.search(after) or re.search(
            r"upside toward\s*([\d,]+)\s*[-–]\s*([\d,]+)",
            after,
            re.I,
        )
        target = None
        if target_m:
            lo = parse_number(target_m.group(1))
            hi = parse_number(target_m.group(2))
            if lo and hi:
                target = round((lo + hi) / 2)
            elif hi:
                target = hi
            elif lo:
                target = lo
        findings.append(
            {
                "name": name,
                "symbol": recommendation_symbol(name),
                "call": "TECHNICAL BUY",
                "target": target,
                "cmp": cmp,
                "horizon": "Weekly technical setup",
                "bucket": "technical",
            }
        )
    return findings


HOLDING_TRADING_SYMBOLS = {
    "ETERNAL",
    "ICICIBANK",
    "JSWENERGY",
    "BHARTIARTL",
}

# Morning-note Investment Picks table rows:
# Company\nBUY\nCMP\nTarget
INVESTMENT_PICK_ROW_RE = re.compile(
    r"(?P<name>[A-Z][A-Za-z0-9 &'./()-]{1,80}?)\s+Ltd\.?\s*\n\s*"
    r"(?P<call>BUY|HOLD|SELL|REDUCE|ADD)\s*\n\s*"
    r"(?P<cmp>[\d,]+(?:\.\d+)?)\s*\n\s*"
    r"(?P<target>[\d,]+(?:\.\d+)?)",
    re.I,
)


def extract_investment_picks_trading(path: Path, text: str) -> list[dict]:
    """Parse Axis Morning Note Investment Picks into Trading-bucket rows for holdings."""
    if "Investment Picks" not in text and "Investment picks" not in text:
        return []
    # Prefer the Investment Picks section when present.
    start = text.find("Investment Picks")
    section = text[start:] if start >= 0 else text
    findings: list[dict] = []
    for match in INVESTMENT_PICK_ROW_RE.finditer(section):
        name = clean_text(match.group("name"))
        symbol = recommendation_symbol(name)
        if symbol not in HOLDING_TRADING_SYMBOLS:
            continue
        call = match.group("call").upper()
        target = parse_number(match.group("target"))
        cmp = parse_number(match.group("cmp"))
        if not target:
            continue
        findings.append(
            {
                "name": name,
                "symbol": symbol,
                "call": "TRADING BUY" if call == "BUY" else call,
                "target": target,
                "cmp": cmp,
                "horizon": "Axis Investment Picks",
                "bucket": "trading",
            }
        )
    return findings


def extract_target_achievements(path: Path, text: str) -> list[dict]:
    """Extract explicit closed-call wins from every readable Axis PDF."""
    compact = clean_text(text)
    if not TARGET_ACHIEVED_RE.search(compact):
        return []
    findings: list[dict] = []
    seen: set[str] = set()
    for achievement_match in ACHIEVEMENT_NAME_RE.finditer(compact):
        raw_name = clean_text(achievement_match.group("name"))
        matched = next(
            (
                (company, symbol)
                for company, symbol in sorted(COMPANY_SYMBOLS, key=lambda row: len(row[0]), reverse=True)
                if company.lower() in raw_name.lower() or raw_name.lower() in company.lower()
            ),
            None,
        )
        if not matched:
            continue
        company, symbol = matched
        if symbol in seen:
            continue
        window = compact[max(0, achievement_match.start() - 40) : min(len(compact), achievement_match.end() + 320)]
        if not TARGET_ACHIEVED_RE.search(window):
            continue
        achieved = re.search(
            r"(?:hit(?:\s+its)?|target(?:\s+price)?(?:\s+of)?|book(?:ed)?(?:\s+profits?)?(?:\s+at)?|TP)\s*(?:Rs\.?|₹|INR)?\s*([\d,]+(?:\.\d+)?)",
            window,
            re.I,
        )
        target = parse_number(achieved.group(1)) if achieved else None
        gain = re.search(r"\+\s*(\d+(?:\.\d+)?)%", window)
        findings.append(
            {
                "symbol": symbol,
                "name": company,
                "call": "TARGET ACHIEVED",
                "target": target,
                "achievedPrice": target,
                "gainPct": parse_number(gain.group(1)) if gain else None,
                "source": "Axis PDF",
                "sourceFile": path.name,
                "dateKey": date_from_path(path),
                "date": format_display_date(date_from_path(path)),
                "thesis": clean_text(window)[:360],
                "origin": "pdf",
            }
        )
        seen.add(symbol)
    return findings


def is_valid_pdf(path: Path) -> bool:
    try:
        with path.open("rb") as fh:
            header = fh.read(5)
        return header == b"%PDF-"
    except OSError:
        return False


def should_skip(path: Path) -> bool:
    if path.suffix.lower() != ".pdf":
        return True
    if SKIP_NAME_RE.search(path.name):
        return True
    # Skip Investment Dashboard nested copies if any
    parts = {p.lower() for p in path.parts}
    if "duplicates" in parts:
        return True
    return False


def extract_from_pdf(path: Path) -> tuple[list[dict], dict]:
    meta = {
        "path": str(path),
        "name": path.name,
        "ok": False,
        "pages": 0,
        "chars": 0,
        "calls": 0,
        "skipReason": None,
    }
    if not is_valid_pdf(path):
        meta["skipReason"] = "invalid_pdf_header"
        return [], meta
    try:
        doc = fitz.open(path)
    except Exception as exc:  # noqa: BLE001
        meta["skipReason"] = f"open_failed:{exc}"
        return [], meta

    try:
        pages = doc.page_count
        text = "\n".join(page.get_text("text") for page in doc)
    finally:
        doc.close()

    meta["ok"] = True
    meta["pages"] = pages
    meta["chars"] = len(text)
    if len(clean_text(text)) < 40:
        meta["skipReason"] = "no_text_layer"
        return [], meta

    doc_kind = classify_doc(path, text)
    if doc_kind in {"technical-market", "other"} and "Buy Range:" not in text:
        # Market outlook / sector notes without stock calls.
        if not TP_RE.search(text) or not CALL_RE.search(text):
            meta["skipReason"] = f"no_stock_call:{doc_kind}"
            return [], meta

    forced_name, forced_symbol = company_from_filename(path)
    findings: list[dict] = []

    if doc_kind == "technical" or "Buy Range:" in text:
        findings.extend(extract_technical_picks(path, text))

    # Holding Progress-to-Target Trading Calls from Morning Note Investment Picks.
    if doc_kind == "morning" or re.search(r"morning.?note", path.name, re.I):
        findings.extend(extract_investment_picks_trading(path, text))

    if doc_kind in {"fundamental", "trading", "morning", "other"} or forced_name:
        findings.extend(
            extract_fundamental_from_text(
                path,
                text,
                forced_name=forced_name,
                forced_symbol=forced_symbol,
                doc_kind=doc_kind if doc_kind != "morning" else "fundamental",
            )
        )

    # Deduplicate within file by symbol+bucket
    uniq: dict[str, dict] = {}
    date_key = date_from_path(path)
    for item in findings:
        if not item.get("symbol") or item["symbol"] == "UNKNOWN":
            continue
        if not item.get("call"):
            continue
        # Require a target for progress UI honesty; still keep HOLD/BUY without TP only if call present
        key = f"{item['symbol']}|{item.get('bucket', 'fundamental')}"
        enriched = {
            **item,
            "source": "Axis PDF",
            "sourceFile": path.name,
            "sourcePath": str(path),
            "dateKey": date_key,
            "date": format_display_date(date_key),
            "thesis": f"{item['name']}: {item['call']}"
            + (f" · TP ₹{int(item['target']):,}" if item.get("target") else ""),
        }
        prev = uniq.get(key)
        if not prev or (enriched.get("target") and not prev.get("target")):
            uniq[key] = enriched

    meta["calls"] = len(uniq)
    if not uniq and not meta.get("skipReason"):
        meta["skipReason"] = "parsed_no_calls"
    return list(uniq.values()), meta


def merge_latest(calls: list[dict]) -> list[dict]:
    """Keep best call per symbol+bucket (dedicated PDF + CMP, then latest date)."""
    best: dict[str, dict] = {}
    for item in calls:
        key = f"{item['symbol']}|{item.get('bucket', 'fundamental')}"
        prev = best.get(key)
        if not prev or source_rank(item) >= source_rank(prev):
            best[key] = item
    return sorted(best.values(), key=lambda row: (row.get("dateKey") or "", row["symbol"]), reverse=True)


def all_dated_calls(calls: list[dict], *, since: str | None = "2026-07-01") -> list[dict]:
    """Keep every extractable call (per source PDF), optionally since a date key."""
    kept = []
    seen: set[str] = set()
    for item in calls:
        date_key = item.get("dateKey") or ""
        if since and date_key and date_key < since:
            continue
        if since and not date_key:
            # Undated reports are excluded from the since-July board to avoid fake dating.
            continue
        identity = f"{item.get('sourceFile')}|{item['symbol']}|{item.get('bucket', 'fundamental')}|{item.get('call')}|{item.get('target')}"
        if identity in seen:
            continue
        seen.add(identity)
        kept.append(item)
    return sorted(
        kept,
        key=lambda row: (row.get("dateKey") or "", row["symbol"], row.get("sourceFile") or ""),
        reverse=True,
    )


def main() -> int:
    archive = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_ARCHIVE
    if not archive.is_dir():
        print(f"Archive not found: {archive}", file=sys.stderr)
        return 1

    pdfs = sorted({p.resolve() for p in archive.rglob("*.pdf") if p.is_file()})
    scanned = []
    all_calls: list[dict] = []
    target_achievements: list[dict] = []
    invalid = []
    skip_reasons = Counter()

    for path in pdfs:
        if should_skip(path):
            skip_reasons["filtered_by_name"] += 1
            continue
        calls, meta = extract_from_pdf(path)
        if meta.get("ok"):
            try:
                doc = fitz.open(path)
                achievement_text = "\n".join(page.get_text("text") for page in doc)
                doc.close()
                target_achievements.extend(extract_target_achievements(path, achievement_text))
            except Exception:  # noqa: BLE001
                pass
        scanned.append(meta)
        if meta.get("skipReason") == "invalid_pdf_header":
            try:
                rel = str(path.relative_to(archive))
            except ValueError:
                rel = path.name
            invalid.append(rel)
        if meta.get("skipReason"):
            skip_reasons[meta["skipReason"]] += 1
        all_calls.extend(calls)

    # Deduped board for I-4; history retained for audit/debug.
    recommendations = merge_latest(all_calls)
    history = all_dated_calls(all_calls, since="2026-07-01")
    # The generated Investment Brief PDFs are source-backed reconciliations of
    # Mail plus downloaded Axis reports. They are intentionally excluded from
    # active-call extraction, but remain valid Target Achieved evidence.
    brief_pdfs = sorted({p.resolve() for p in archive.rglob("Investment_Brief_*.pdf") if p.is_file()})
    for path in brief_pdfs:
        try:
            doc = fitz.open(path)
            brief_text = "\n".join(page.get_text("text") for page in doc)
            doc.close()
            target_achievements.extend(extract_target_achievements(path, brief_text))
        except Exception:  # noqa: BLE001
            pass

    achievement_best: dict[str, dict] = {}
    for item in target_achievements:
        identity = f"{item['symbol']}|{item.get('dateKey') or ''}|{item.get('target') or ''}"
        if identity not in achievement_best:
            achievement_best[identity] = item
    achievements = sorted(
        achievement_best.values(),
        key=lambda row: (row.get("dateKey") or "", row["symbol"]),
        reverse=True,
    )
    by_bucket = Counter(item.get("bucket", "fundamental") for item in recommendations)
    with_progress = sum(1 for item in recommendations if item.get("cmp") and item.get("target"))
    without_progress = len(recommendations) - with_progress
    since_july_raw = sum(1 for item in all_calls if (item.get("dateKey") or "") >= "2026-07-01")

    payload = {
        "asOf": datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds"),
        "archivePath": str(archive),
        "filesAttempted": len(pdfs),
        "filesScanned": len(scanned),
        "validPdfs": sum(1 for item in scanned if item.get("ok")),
        "pagesRead": sum(int(item.get("pages") or 0) for item in scanned),
        "invalidFiles": invalid,
        "skipReasons": dict(skip_reasons),
        "callsExtractedRaw": len(all_calls),
        "callsSinceJulyRaw": since_july_raw,
        "recommendationsHistory": history,
        "recommendations": recommendations,
        "targetAchievements": achievements,
        "sinceDate": "2026-07-01",
        "counts": {
            "total": len(recommendations),
            "fundamental": by_bucket.get("fundamental", 0),
            "technical": by_bucket.get("technical", 0),
            "trading": by_bucket.get("trading", 0),
            "withCmpAndTarget": with_progress,
            "missingProgressInputs": without_progress,
            "historyRows": len(history),
            "targetAchievements": len(achievements),
        },
        "filesWithCalls": sum(1 for item in scanned if item.get("calls")),
        "sampleSkipped": [
            {"name": item["name"], "reason": item.get("skipReason")}
            for item in scanned
            if item.get("skipReason") and item.get("skipReason") != "filtered_by_name"
        ][:40],
    }

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(
        json.dumps(
            {
                "wrote": str(OUTPUT),
                "pdfsFound": len(pdfs),
                "validPdfs": payload["validPdfs"],
                "recommendations": payload["counts"],
                "invalid": len(invalid),
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
