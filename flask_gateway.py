from __future__ import annotations

import hashlib
import hmac
import json
import os
from datetime import datetime, timedelta, timezone
from html import escape
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin
from urllib.request import Request as UpstreamRequest
from urllib.request import urlopen

from flask import Flask, Response, request


ROOT = Path(__file__).resolve().parent
UPSTREAM = os.environ.get("DASHBOARD_UPSTREAM", "http://127.0.0.1:3000").rstrip("/") + "/"
UPSTREAM_TIMEOUT_SECONDS = int(os.environ.get("DASHBOARD_UPSTREAM_TIMEOUT", "180"))
HEALTH_SNAPSHOT_PATH = Path(os.environ.get(
    "PORTFOLIO_HEALTH_SNAPSHOT_PATH",
    ROOT / "artifacts" / "private" / "health-snapshot.json",
))
STARTUP_AUDIT_PATH = Path(os.environ.get(
    "PORTFOLIO_STARTUP_AUDIT_PATH",
    ROOT / "artifacts" / "private" / "startup-audit.json",
))
# Shared secret for HealthKit POST. Override via PORTFOLIO_HEALTH_TOKEN in production.
HEALTH_TOKEN = os.environ.get("PORTFOLIO_HEALTH_TOKEN", "portfolio-local-health-token")
MAX_HEALTH_SNAPSHOT_BYTES = 512 * 1024
IST = timezone(timedelta(hours=5, minutes=30))
HOP_BY_HOP_HEADERS = {
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailers",
    "transfer-encoding",
    "upgrade",
}

app = Flask(__name__)


def _health_snapshot_response(payload: dict, status: int = 200) -> Response:
    response = Response(json.dumps(payload), status=status, content_type="application/json")
    response.headers["Cache-Control"] = "no-store, max-age=0"
    response.headers["X-Portfolio-Gateway"] = "Flask"
    return response


def _authorized_health_post() -> bool:
    provided = request.headers.get("X-Portfolio-Health-Token") or ""
    auth = request.headers.get("Authorization") or ""
    if auth.lower().startswith("bearer "):
        provided = auth[7:].strip()
    if not provided or not HEALTH_TOKEN:
        return False
    return hmac.compare_digest(
        hashlib.sha256(provided.encode("utf-8")).digest(),
        hashlib.sha256(HEALTH_TOKEN.encode("utf-8")).digest(),
    )


def _valid_health_snapshot(payload: object) -> bool:
    if not isinstance(payload, dict):
        return False
    if payload.get("schemaVersion") != 1 or payload.get("source") != "Apple Health":
        return False
    if not isinstance(payload.get("dataDate"), str) or not isinstance(payload.get("capturedAt"), str):
        return False
    categories = payload.get("categories")
    if not isinstance(categories, list) or not 1 <= len(categories) <= 12:
        return False
    for category in categories:
        if not isinstance(category, dict) or not isinstance(category.get("name"), str):
            return False
        metrics = category.get("metrics")
        if not isinstance(metrics, list) or len(metrics) > 40:
            return False
        if any(not isinstance(metric, dict) or not isinstance(metric.get("label"), str) or not isinstance(metric.get("value"), str) for metric in metrics):
            return False
    return True


def _upstream_url(path: str) -> str:
    target = urljoin(UPSTREAM, path)
    if request.query_string:
        target = f"{target}?{request.query_string.decode('latin-1')}"
    return target


def _request_headers() -> dict[str, str]:
    headers: dict[str, str] = {}
    for key, value in request.headers.items():
        lowered = key.lower()
        if lowered in HOP_BY_HOP_HEADERS or lowered in {"host", "content-length", "accept-encoding"}:
            continue
        headers[key] = value
    headers["Accept-Encoding"] = "identity"
    headers["X-Forwarded-Host"] = request.host
    headers["X-Forwarded-Proto"] = request.scheme
    headers["X-Forwarded-For"] = request.remote_addr or ""
    return headers


def _response_headers(source_headers) -> list[tuple[str, str]]:
    headers: list[tuple[str, str]] = []
    force_no_store = request.path in {"/", "/sw.js", "/manifest.webmanifest"}
    for key, value in source_headers.items():
        lowered = key.lower()
        if lowered in HOP_BY_HOP_HEADERS or lowered in {"content-length", "content-encoding"}:
            continue
        if force_no_store and lowered == "cache-control":
            continue
        if lowered == "location":
            value = value.replace(UPSTREAM.rstrip("/"), request.host_url.rstrip("/"))
        headers.append((key, value))
    if force_no_store:
        headers.append(("Cache-Control", "no-store, max-age=0"))
    headers.append(("X-Portfolio-Gateway", "Flask"))
    return headers


def _proxy_error(message: str, status: int = 502) -> Response:
    if request.path.startswith("/api/"):
        return Response(
            json.dumps({"status": "unavailable", "message": message}),
            status=status,
            content_type="application/json",
        )
    return Response(
        f"""<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1">
        <title>Portfolio Intelligence unavailable</title><style>
        body{{margin:0;min-height:100vh;display:grid;place-items:center;background:#050607;color:#f1f2f3;font:16px system-ui}}
        main{{width:min(520px,calc(100% - 40px));border:1px solid #2b3138;border-top:4px solid #ff6b72;padding:28px;background:#0d1013}}
        h1{{margin-top:0}}p{{color:#aab1b9;line-height:1.6}}a{{color:#72aaff}}
        </style><main><h1>Mac dashboard is unavailable</h1><p>{escape(message)}</p>
        <p>Keep the Mac awake, start the dashboard, then reload this page.</p><a href="/">Try again</a></main></html>""",
        status=status,
        content_type="text/html",
    )


@app.get("/_flask/health")
def health() -> Response:
    try:
        probe = UpstreamRequest(UPSTREAM, method="GET", headers={"Accept-Encoding": "identity"})
        with urlopen(probe, timeout=3) as upstream_response:
            upstream_status = upstream_response.status
    except (HTTPError, URLError, TimeoutError):
        upstream_status = 0
    payload = {
        "status": "ok" if upstream_status == 200 else "degraded",
        "gateway": "flask",
        "upstream": UPSTREAM.rstrip("/"),
        "upstreamStatus": upstream_status,
        "installUrl": request.host_url,
    }
    return Response(json.dumps(payload), status=200 if upstream_status == 200 else 503, content_type="application/json")


@app.get("/_startup/audit")
def startup_audit() -> Response:
    try:
        payload = json.loads(STARTUP_AUDIT_PATH.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return _health_snapshot_response({
            "status": "unknown",
            "failures": -1,
            "message": "No startup refresh audit has been recorded yet.",
        }, 404)
    except (OSError, json.JSONDecodeError):
        return _health_snapshot_response({
            "status": "unavailable",
            "failures": -1,
            "message": "The startup refresh audit could not be read.",
        }, 503)
    return _health_snapshot_response(payload)


@app.route("/_health/snapshot", methods=["GET", "POST"])
def health_snapshot() -> Response:
    if request.method == "GET":
        try:
            payload = json.loads(HEALTH_SNAPSHOT_PATH.read_text(encoding="utf-8"))
        except FileNotFoundError:
            return _health_snapshot_response({
                "status": "unavailable",
                "message": "No iPhone HealthKit snapshot has been received yet.",
            }, 404)
        except (OSError, json.JSONDecodeError):
            return _health_snapshot_response({
                "status": "unavailable",
                "message": "The stored HealthKit snapshot could not be read.",
            }, 503)
        return _health_snapshot_response(payload)

    if not _authorized_health_post():
        return _health_snapshot_response({
            "status": "unauthorized",
            "message": "Health snapshot POST requires Authorization: Bearer <PORTFOLIO_HEALTH_TOKEN> or X-Portfolio-Health-Token.",
        }, 401)

    if request.content_length is not None and request.content_length > MAX_HEALTH_SNAPSHOT_BYTES:
        return _health_snapshot_response({"status": "invalid", "message": "Health snapshot is too large."}, 413)

    payload = request.get_json(silent=True)
    if not _valid_health_snapshot(payload):
        return _health_snapshot_response({"status": "invalid", "message": "Health snapshot schema is invalid."}, 400)

    data_date = str(payload.get("dataDate") or "")
    required_d1 = (datetime.now(IST) - timedelta(days=1)).strftime("%Y-%m-%d")
    payload["status"] = "live" if data_date >= required_d1 else "stale"
    payload["receivedAt"] = datetime.now(timezone.utc).isoformat()
    if payload["status"] == "stale":
        payload["message"] = f"HealthKit snapshot stored but dataDate {data_date} is behind required D-1 {required_d1}."
    try:
        HEALTH_SNAPSHOT_PATH.parent.mkdir(parents=True, exist_ok=True)
        temporary_path = HEALTH_SNAPSHOT_PATH.with_suffix(".tmp")
        temporary_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        temporary_path.replace(HEALTH_SNAPSHOT_PATH)
    except OSError as error:
        return _health_snapshot_response({"status": "unavailable", "message": f"Could not persist Health snapshot: {error}"}, 500)

    return _health_snapshot_response({
        "status": payload["status"],
        "dataDate": payload["dataDate"],
        "capturedAt": payload["capturedAt"],
        "message": payload.get("message") or "HealthKit snapshot stored on this Mac.",
    }, 201)


@app.get("/install")
def install() -> Response:
    dashboard_url = request.host_url
    return Response(
        f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
        <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
        <meta name="theme-color" content="#050607"><title>Install Portfolio Intelligence</title>
        <style>body{{margin:0;background:#050607;color:#f1f2f3;font:16px system-ui;line-height:1.55}}
        main{{width:min(720px,calc(100% - 36px));margin:40px auto}}h1{{font:700 38px Georgia,serif}}
        section{{border-top:3px solid #4c8fff;background:#0d1013;padding:22px;margin:18px 0}}
        li{{margin:10px 0;color:#c5cbd2}}a{{display:inline-block;background:#174b84;color:white;padding:11px 14px;text-decoration:none;font-weight:800}}
        code{{color:#8fc2ff}}</style></head><body><main><h1>Install Portfolio Intelligence</h1>
        <p>This private app stays on your Mac and is shared with your iPhone over the same trusted Wi-Fi network.</p>
        <section><h2>iPhone or iPad</h2><ol><li>Open <code>{escape(dashboard_url)}</code> in Safari.</li>
        <li>Tap Share.</li><li>Choose <b>Add to Home Screen</b>.</li><li>Tap <b>Add</b>.</li></ol></section>
        <section><h2>macOS</h2><ol><li>Open the dashboard in Safari.</li><li>Choose <b>File → Add to Dock</b>.</li>
        <li>Open Portfolio Intelligence from the Dock or Applications.</li></ol></section>
        <a href="/">Open dashboard</a></main></body></html>""",
        content_type="text/html",
    )


@app.route("/", defaults={"path": ""}, methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"])
@app.route("/<path:path>", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"])
def proxy(path: str) -> Response:
    body = request.get_data(cache=False) if request.method not in {"GET", "HEAD"} else None
    upstream_request = UpstreamRequest(
        _upstream_url(path),
        data=body,
        headers=_request_headers(),
        method=request.method,
    )
    try:
        with urlopen(upstream_request, timeout=UPSTREAM_TIMEOUT_SECONDS) as upstream_response:
            payload = b"" if request.method == "HEAD" else upstream_response.read()
            return Response(payload, status=upstream_response.status, headers=_response_headers(upstream_response.headers))
    except HTTPError as error:
        payload = b"" if request.method == "HEAD" else error.read()
        return Response(payload, status=error.code, headers=_response_headers(error.headers))
    except (URLError, TimeoutError) as error:
        return _proxy_error(f"The Flask gateway could not reach {UPSTREAM.rstrip('/')}: {error.reason if isinstance(error, URLError) else error}")


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "5050")), debug=False)
