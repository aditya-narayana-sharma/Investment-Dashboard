from __future__ import annotations

import hashlib
import hmac
import ipaddress
import json
import os
import secrets
import threading
from datetime import datetime, timedelta, timezone
from html import escape
from pathlib import Path
from http.client import RemoteDisconnected
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin
from urllib.request import Request as UpstreamRequest
from urllib.request import urlopen

from flask import Flask, Response, request


ROOT = Path(__file__).resolve().parent
UPSTREAM = os.environ.get("DASHBOARD_UPSTREAM", "http://127.0.0.1:3000").rstrip("/") + "/"
UPSTREAM_TIMEOUT_SECONDS = int(os.environ.get("DASHBOARD_UPSTREAM_TIMEOUT", "180"))
# Content digest force-refresh can take up to 300s in the Next route; keep gateway ahead of that.
CONTENT_REFRESH_TIMEOUT_SECONDS = int(os.environ.get("DASHBOARD_CONTENT_REFRESH_TIMEOUT", "320"))
HEALTH_SNAPSHOT_PATH = Path(os.environ.get(
    "PORTFOLIO_HEALTH_SNAPSHOT_PATH",
    ROOT / "artifacts" / "private" / "health-snapshot.json",
))
STARTUP_AUDIT_PATH = Path(os.environ.get(
    "PORTFOLIO_STARTUP_AUDIT_PATH",
    ROOT / "artifacts" / "private" / "startup-audit.json",
))
HEALTH_PAIRINGS_PATH = Path(os.environ.get(
    "PORTFOLIO_HEALTH_PAIRINGS_PATH",
    ROOT / "artifacts" / "private" / "health-pairings.json",
))
# Shared secret for HealthKit POST. Override via PORTFOLIO_HEALTH_TOKEN in production.
HEALTH_TOKEN = os.environ.get("PORTFOLIO_HEALTH_TOKEN", "portfolio-local-health-token")
MAX_HEALTH_SNAPSHOT_BYTES = 512 * 1024
PAIRING_CODE_TTL_SECONDS = 5 * 60
IST = timezone(timedelta(hours=5, minutes=30))
PAIRING_CODES: dict[str, datetime] = {}
PAIRING_LOCK = threading.Lock()
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

app = Flask("Portfolio Intelligence")
app.config["APP_NAME"] = "Portfolio Intelligence"


def _health_snapshot_response(payload: dict, status: int = 200) -> Response:
    response = Response(json.dumps(payload), status=status, content_type="application/json")
    response.headers["Cache-Control"] = "no-store, max-age=0"
    response.headers["X-Portfolio-Gateway"] = "Flask"
    return response


def _token_digest(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _load_health_pairings() -> dict:
    try:
        payload = json.loads(HEALTH_PAIRINGS_PATH.read_text(encoding="utf-8"))
    except (FileNotFoundError, OSError, json.JSONDecodeError):
        return {"schemaVersion": 1, "installations": {}}
    if not isinstance(payload, dict) or not isinstance(payload.get("installations"), dict):
        return {"schemaVersion": 1, "installations": {}}
    return payload


def _write_health_pairings(payload: dict) -> None:
    HEALTH_PAIRINGS_PATH.parent.mkdir(parents=True, exist_ok=True)
    temporary = HEALTH_PAIRINGS_PATH.with_suffix(".tmp")
    temporary.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    os.chmod(temporary, 0o600)
    temporary.replace(HEALTH_PAIRINGS_PATH)


def _shared_health_token_matches(provided: str) -> bool:
    if not provided or not HEALTH_TOKEN:
        return False
    return hmac.compare_digest(_token_digest(provided), _token_digest(HEALTH_TOKEN))


def _paired_health_token_matches(provided: str) -> bool:
    if not provided:
        return False
    provided_digest = _token_digest(provided)
    with PAIRING_LOCK:
        pairings = _load_health_pairings()
        for install_id, installation in pairings["installations"].items():
            stored_digest = installation.get("tokenHash") if isinstance(installation, dict) else None
            if isinstance(stored_digest, str) and hmac.compare_digest(provided_digest, stored_digest):
                installation["lastUsedAt"] = datetime.now(timezone.utc).isoformat()
                pairings["installations"][install_id] = installation
                try:
                    _write_health_pairings(pairings)
                except OSError:
                    pass
                return True
    return False


def _provided_health_token() -> str:
    provided = request.headers.get("X-Portfolio-Health-Token") or ""
    auth = request.headers.get("Authorization") or ""
    if auth.lower().startswith("bearer "):
        provided = auth[7:].strip()
    return provided


def _authorized_health_post() -> bool:
    provided = _provided_health_token()
    return _shared_health_token_matches(provided) or _paired_health_token_matches(provided)


def _authorized_pairing_admin() -> bool:
    remote = request.remote_addr or ""
    try:
        if ipaddress.ip_address(remote).is_loopback:
            return True
    except ValueError:
        pass
    return _shared_health_token_matches(_provided_health_token())


def _valid_install_id(value: object) -> bool:
    if not isinstance(value, str) or not 8 <= len(value) <= 100:
        return False
    return all(character.isalnum() or character in "-_" for character in value)


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
        "app": "Portfolio Intelligence",
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


@app.post("/_health/pair/code")
def create_health_pairing_code() -> Response:
    if not _authorized_pairing_admin():
        return _health_snapshot_response({
            "status": "unauthorized",
            "message": "Pairing codes can only be generated locally on the Mac or with the configured Health admin token.",
        }, 401)

    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(seconds=PAIRING_CODE_TTL_SECONDS)
    code = secrets.token_hex(4).upper()
    with PAIRING_LOCK:
        expired = [value for value, expiry in PAIRING_CODES.items() if expiry <= now]
        for value in expired:
            PAIRING_CODES.pop(value, None)
        PAIRING_CODES[code] = expires_at
    return _health_snapshot_response({
        "status": "ready",
        "code": code,
        "expiresAt": expires_at.isoformat(),
        "expiresInSeconds": PAIRING_CODE_TTL_SECONDS,
        "message": "Enter this one-time code in the Portfolio Intelligence iPhone app.",
    }, 201)


@app.post("/_health/pair")
def pair_health_installation() -> Response:
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return _health_snapshot_response({"status": "invalid", "message": "Pairing request must be JSON."}, 400)

    code = str(payload.get("code") or "").strip().upper()
    install_id = payload.get("installId")
    label = str(payload.get("label") or "Portfolio Intelligence iPhone").strip()[:80]
    if not code or not _valid_install_id(install_id):
        return _health_snapshot_response({
            "status": "invalid",
            "message": "A valid pairing code and installId are required.",
        }, 400)

    now = datetime.now(timezone.utc)
    with PAIRING_LOCK:
        expiry = PAIRING_CODES.pop(code, None)
        if expiry is None or expiry <= now:
            return _health_snapshot_response({
                "status": "invalid",
                "message": "The pairing code is invalid or expired. Generate a new code on the Mac.",
            }, 401)

        token = secrets.token_urlsafe(32)
        pairings = _load_health_pairings()
        pairings["installations"][install_id] = {
            "tokenHash": _token_digest(token),
            "label": label or "Portfolio Intelligence iPhone",
            "createdAt": now.isoformat(),
            "lastUsedAt": None,
        }
        try:
            _write_health_pairings(pairings)
        except OSError as error:
            return _health_snapshot_response({
                "status": "unavailable",
                "message": f"Could not persist Health pairing: {error}",
            }, 500)

    return _health_snapshot_response({
        "status": "paired",
        "installId": install_id,
        "token": token,
        "createdAt": now.isoformat(),
        "message": "HealthKit upload paired with this Mac.",
    }, 201)


@app.delete("/_health/pair/<install_id>")
def revoke_health_installation(install_id: str) -> Response:
    if not _authorized_pairing_admin():
        return _health_snapshot_response({
            "status": "unauthorized",
            "message": "Health pairing revocation requires local Mac access or the configured Health admin token.",
        }, 401)
    if not _valid_install_id(install_id):
        return _health_snapshot_response({"status": "invalid", "message": "Invalid installId."}, 400)

    with PAIRING_LOCK:
        pairings = _load_health_pairings()
        removed = pairings["installations"].pop(install_id, None)
        try:
            _write_health_pairings(pairings)
        except OSError as error:
            return _health_snapshot_response({
                "status": "unavailable",
                "message": f"Could not update Health pairings: {error}",
            }, 500)
    return _health_snapshot_response({
        "status": "revoked" if removed else "not_found",
        "installId": install_id,
        "message": "Health pairing revoked." if removed else "No Health pairing exists for this installId.",
    }, 200 if removed else 404)


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
    dashboard_url = request.host_url.rstrip("/") + "/"
    return Response(
        f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
        <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
        <meta name="apple-mobile-web-app-capable" content="yes">
        <meta name="apple-mobile-web-app-title" content="Portfolio">
        <meta name="theme-color" content="#050607"><title>Install Portfolio Intelligence</title>
        <link rel="manifest" href="/manifest.webmanifest">
        <link rel="apple-touch-icon" href="/app-icon-192.png">
        <style>body{{margin:0;background:#050607;color:#f1f2f3;font:16px system-ui;line-height:1.55}}
        main{{width:min(720px,calc(100% - 36px));margin:40px auto}}h1{{font:700 38px Georgia,serif}}
        section{{border-top:3px solid #4c8fff;background:#0d1013;padding:22px;margin:18px 0}}
        li{{margin:10px 0;color:#c5cbd2}}a{{display:inline-block;background:#174b84;color:white;padding:11px 14px;text-decoration:none;font-weight:800;margin-right:10px;margin-top:8px}}
        code{{color:#8fc2ff;word-break:break-all}}</style></head><body><main><h1>Install Portfolio Intelligence</h1>
        <p>Private app hosted on your Mac. Install once on Dock and Home Screen; it keeps using this Mac as the server.</p>
        <section><h2>iPhone or iPad</h2><ol>
        <li>Open this page in <b>Safari</b> (not Chrome): <code>{escape(dashboard_url)}</code></li>
        <li>Tap the Share button.</li>
        <li>Choose <b>Add to Home Screen</b>.</li>
        <li>Tap <b>Add</b>. The icon opens as a standalone app.</li></ol>
        <p>Prefer Tailscale on both devices for mobile-data access. Same Wi-Fi works when the Mac is bound for LAN.</p></section>
        <section><h2>Mac Dock app</h2><ol>
        <li>On the Mac run <code>npm run desktop</code> once (creates <b>Portfolio Intelligence.app</b> in ~/Applications and pins it to the Dock).</li>
        <li>Or in Safari open the dashboard and choose <b>File → Add to Dock</b>.</li>
        <li>The Dock icon starts the local service if needed and opens the app window.</li></ol></section>
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
    timeout_seconds = (
        CONTENT_REFRESH_TIMEOUT_SECONDS
        if path.startswith("api/content/")
        else UPSTREAM_TIMEOUT_SECONDS
    )
    try:
        with urlopen(upstream_request, timeout=timeout_seconds) as upstream_response:
            payload = b"" if request.method == "HEAD" else upstream_response.read()
            return Response(payload, status=upstream_response.status, headers=_response_headers(upstream_response.headers))
    except HTTPError as error:
        payload = b"" if request.method == "HEAD" else error.read()
        return Response(payload, status=error.code, headers=_response_headers(error.headers))
    except (URLError, TimeoutError, RemoteDisconnected, ConnectionResetError, BrokenPipeError, OSError) as error:
        reason = error.reason if isinstance(error, URLError) else error
        return _proxy_error(f"The Flask gateway could not reach {UPSTREAM.rstrip('/')}: {reason}")


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "5050")), debug=False)
