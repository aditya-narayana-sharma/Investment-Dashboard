from __future__ import annotations

import hashlib
import hmac
import ipaddress
import json
import os
import secrets
import threading
import base64
from datetime import datetime, timedelta, timezone
from html import escape
from pathlib import Path
from http.client import RemoteDisconnected
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin
from urllib.request import Request as UpstreamRequest
from urllib.request import urlopen

from flask import Flask, Response, request
from scripts.health_date_policy import health_target_context


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
STARTUP_PROGRESS_PATH = Path(os.environ.get(
    "PORTFOLIO_STARTUP_PROGRESS_PATH",
    ROOT / "artifacts" / "private" / "startup-progress.json",
))
HEALTH_PAIRINGS_PATH = Path(os.environ.get(
    "PORTFOLIO_HEALTH_PAIRINGS_PATH",
    ROOT / "artifacts" / "private" / "health-pairings.json",
))
# Optional Mac-admin token retained for automation/backward compatibility.
# Native iPhone builds use a per-install token issued by the pairing flow.
HEALTH_TOKEN = os.environ.get("PORTFOLIO_HEALTH_TOKEN", "")
MAX_HEALTH_SNAPSHOT_BYTES = 512 * 1024
PAIRING_CODE_TTL_SECONDS = 5 * 60
IST = timezone(timedelta(hours=5, minutes=30))
PAIRING_CODES: dict[str, datetime] = {}
PAIRING_LOCK = threading.Lock()
AUTH0_SESSION_COOKIE = "stratji_author"
AUTH0_SESSION_DAYS = 14
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


def _load_private_auth0_env() -> None:
    path = ROOT / "artifacts" / "private" / "auth0.env"
    if not path.is_file():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        if key.startswith("AUTH0_") and key not in os.environ:
            os.environ[key] = value.strip().strip('"').strip("'")


_load_private_auth0_env()


def _current_health_target():
    return health_target_context(datetime.now(IST))


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


def _paired_health_token_matches_install(provided: str, install_id: str) -> bool:
    if not provided:
        return False
    pairings = _load_health_pairings()
    installation = pairings["installations"].get(install_id)
    if not isinstance(installation, dict) or not isinstance(installation.get("tokenHash"), str):
        return False
    return hmac.compare_digest(_token_digest(provided), installation["tokenHash"])


def _provided_health_token() -> str:
    provided = request.headers.get("X-Portfolio-Health-Token") or ""
    auth = request.headers.get("Authorization") or ""
    if auth.lower().startswith("bearer "):
        provided = auth[7:].strip()
    if not provided:
        provided = request.cookies.get("stratji_device") or ""
    if not provided:
        cookie_header = request.headers.get("Cookie") or ""
        for part in cookie_header.split(";"):
            name, _, value = part.strip().partition("=")
            if name == "stratji_device" and value:
                provided = value
                break
    return provided


def _is_loopback_request() -> bool:
    remote = request.remote_addr or ""
    try:
        return ipaddress.ip_address(remote).is_loopback
    except ValueError:
        return remote in {"127.0.0.1", "::1", "localhost"}


def _authorized_health_post() -> bool:
    provided = _provided_health_token()
    return _shared_health_token_matches(provided) or _paired_health_token_matches(provided)


def _authorized_pairing_admin() -> bool:
    if _is_loopback_request():
        return True
    return _shared_health_token_matches(_provided_health_token())


def _auth0_domain() -> str:
    return os.environ.get("AUTH0_DOMAIN", "").strip().rstrip("/")


def _auth0_is_configured() -> bool:
    domain = _auth0_domain()
    return bool(domain) and not domain.upper().startswith("YOUR_")


def _auth0_author_email() -> str:
    return os.environ.get("AUTH0_AUTHOR_EMAIL", "").strip().lower()


def _auth0_session_secret() -> bytes:
    env = os.environ.get("AUTH0_SESSION_SECRET", "").strip()
    if env:
        return env.encode("utf-8")
    path = ROOT / "artifacts" / "private" / "auth0-session-secret"
    if path.is_file():
        return path.read_bytes().strip()
    path.parent.mkdir(parents=True, exist_ok=True)
    secret = secrets.token_hex(32).encode("utf-8")
    path.write_bytes(secret)
    return secret


def _verify_auth0_access_token(access_token: str) -> dict | None:
    if not _auth0_is_configured() or not access_token:
        return None
    request = UpstreamRequest(
        f"https://{_auth0_domain()}/userinfo",
        headers={
            "Authorization": f"Bearer {access_token}",
            "Accept": "application/json",
        },
        method="GET",
    )
    try:
        with urlopen(request, timeout=10) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except (HTTPError, URLError, TimeoutError, ValueError, OSError):
        return None
    if not isinstance(payload, dict) or not payload.get("sub"):
        return None
    return payload


def _author_allowed(profile: dict) -> bool:
    allowed = _auth0_author_email()
    if not allowed:
        return True
    email = str(profile.get("email") or "").strip().lower()
    return email == allowed


def _sign_author_session(profile: dict) -> str:
    expires = datetime.now(timezone.utc) + timedelta(days=AUTH0_SESSION_DAYS)
    payload = json.dumps({
        "email": profile.get("email") or "",
        "name": profile.get("name") or "",
        "sub": profile.get("sub") or "",
        "exp": int(expires.timestamp()),
    }, separators=(",", ":"))
    body = base64.urlsafe_b64encode(payload.encode("utf-8")).decode("ascii").rstrip("=")
    signature = hmac.new(_auth0_session_secret(), body.encode("ascii"), hashlib.sha256).hexdigest()
    return f"{body}.{signature}"


def _read_author_session() -> dict | None:
    raw = request.cookies.get(AUTH0_SESSION_COOKIE) or ""
    if "." not in raw:
        return None
    body, _, signature = raw.partition(".")
    expected = hmac.new(_auth0_session_secret(), body.encode("ascii"), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(signature, expected):
        return None
    padding = "=" * ((4 - len(body) % 4) % 4)
    try:
        payload = json.loads(base64.urlsafe_b64decode(body + padding).decode("utf-8"))
    except (ValueError, json.JSONDecodeError):
        return None
    if not isinstance(payload, dict):
        return None
    try:
        exp = int(payload.get("exp") or 0)
    except (TypeError, ValueError):
        return None
    if exp < int(datetime.now(timezone.utc).timestamp()):
        return None
    return payload


def _author_session_response(payload: dict, status: int = 200) -> Response:
    return Response(json.dumps(payload), status=status, content_type="application/json")


def _lan_path_is_public() -> bool:
    if request.method == "OPTIONS":
        return True
    path = request.path.rstrip("/") or "/"
    if path == "/_flask/health" and request.method == "GET":
        return True
    if path == "/_health/pair" and request.method == "POST":
        return True
    return False


@app.before_request
def _require_paired_phone_on_lan() -> Response | None:
    path = (request.path or "/").lstrip("/")
    if _operator_only_proxy(path) and not _is_loopback_request():
        return Response(
            '{"error":"This action is only available on the author Mac."}',
            status=403,
            content_type="application/json",
        )
    if _is_loopback_request() or _lan_path_is_public():
        return None
    if _authorized_health_post():
        return None
    return _health_snapshot_response({
        "status": "unauthorized",
        "message": "Pair this iPhone from the Mac with npm run iphone:pair before loading private data over the local network.",
    }, 401)


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
    try:
        data_date = datetime.strptime(payload["dataDate"], "%Y-%m-%d").date()
        captured_at = datetime.fromisoformat(payload["capturedAt"].replace("Z", "+00:00"))
    except ValueError:
        return False
    if data_date > datetime.now(IST).date() or captured_at.tzinfo is None:
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


def _operator_only_proxy(path: str) -> bool:
    method = (request.method or "").upper()
    if path == "api/llm/complete" and method == "POST":
        return True
    if path == "api/license" and method in {"PUT", "PATCH"}:
        return True
    if path == "api/integrations" and method in {"PUT", "PATCH"}:
        return True
    return False


def _upstream_url(path: str) -> str:
    target = urljoin(UPSTREAM, path)
    if request.query_string:
        target = f"{target}?{request.query_string.decode('latin-1')}"
    return target


def _request_headers() -> dict[str, str]:
    headers: dict[str, str] = {}
    for key, value in request.headers.items():
        lowered = key.lower()
        if lowered in HOP_BY_HOP_HEADERS or lowered in {
            "host",
            "content-length",
            "accept-encoding",
            "x-stratji-local-operator",
        }:
            continue
        headers[key] = value
    headers["Accept-Encoding"] = "identity"
    headers["X-Forwarded-Host"] = request.host
    headers["X-Forwarded-Proto"] = request.scheme
    headers["X-Forwarded-For"] = request.remote_addr or ""
    if _is_loopback_request():
        headers["X-Stratji-Local-Operator"] = "1"
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


@app.get("/_startup/progress")
def startup_progress() -> Response:
    try:
        payload = json.loads(STARTUP_PROGRESS_PATH.read_text(encoding="utf-8"))
    except FileNotFoundError:
        payload = {
            "schemaVersion": 1,
            "status": "unknown",
            "stage": "service",
            "state": "start",
            "label": "No startup refresh progress has been recorded yet.",
            "fraction": 0,
            "completed": [],
            "failed": [],
            "percent": 0,
        }
    except (OSError, json.JSONDecodeError):
        return _health_snapshot_response({
            "status": "unavailable",
            "stage": "service",
            "state": "failed",
            "label": "Startup refresh progress could not be read.",
            "completed": [],
            "failed": [],
            "percent": 0,
        }, 503)
    if isinstance(payload, dict) and "status" not in payload:
        payload["status"] = "ok"
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
    provided = _provided_health_token()
    if not (_authorized_pairing_admin() or _paired_health_token_matches_install(provided, install_id)):
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

    data_date = datetime.strptime(str(payload.get("dataDate")), "%Y-%m-%d").date()
    target = _current_health_target()
    source_status = str(payload.get("status", "partial"))
    allowed_statuses = {"live", "partial", "cached", "stale", "unavailable"}
    payload["targetDate"] = target.target_date.isoformat()
    payload["targetPolicy"] = target.policy
    payload["targetLabel"] = target.label
    payload["requiredThrough"] = target.target_date.isoformat()
    payload.setdefault("eligibleThrough", data_date.isoformat())
    payload["status"] = source_status if source_status in allowed_statuses else "partial"
    if data_date < target.target_date:
        payload["status"] = "stale"
    payload["receivedAt"] = datetime.now(timezone.utc).isoformat()
    if payload["status"] == "stale":
        payload["message"] = (
            f"HealthKit snapshot stored but dataDate {data_date.isoformat()} is behind "
            f"the {target.label} operational target {target.target_date.isoformat()}."
        )
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


@app.get("/_auth/session")
def author_session() -> Response:
    if not _auth0_is_configured():
        return _author_session_response({"status": "disabled", "authenticated": False})
    profile = _read_author_session()
    if not profile:
        return _author_session_response({"status": "unauthenticated", "authenticated": False}, 401)
    return _author_session_response({
        "status": "ok",
        "authenticated": True,
        "email": profile.get("email") or "",
        "name": profile.get("name") or "",
    })


@app.post("/_auth/session")
def create_author_session() -> Response:
    if not _auth0_is_configured():
        return _author_session_response({
            "status": "disabled",
            "message": "Set AUTH0_DOMAIN in artifacts/private/auth0.env to mint a web session cookie.",
        }, 503)
    payload = request.get_json(silent=True) or {}
    access_token = str(payload.get("accessToken") or "")
    profile = _verify_auth0_access_token(access_token)
    if not profile:
        return _author_session_response({
            "status": "unauthorized",
            "message": "Auth0 access token was missing or rejected.",
        }, 401)
    if not _author_allowed(profile):
        return _author_session_response({
            "status": "forbidden",
            "message": "This Auth0 account is not the Stratji author.",
        }, 403)
    response = _author_session_response({
        "status": "ok",
        "authenticated": True,
        "email": profile.get("email") or "",
        "name": profile.get("name") or "",
    })
    response.set_cookie(
        AUTH0_SESSION_COOKIE,
        _sign_author_session(profile),
        httponly=True,
        samesite="Lax",
        path="/",
        max_age=AUTH0_SESSION_DAYS * 24 * 60 * 60,
        secure=request.is_secure,
    )
    return response


@app.post("/_auth/logout")
def clear_author_session() -> Response:
    response = _author_session_response({"status": "ok", "authenticated": False})
    response.delete_cookie(AUTH0_SESSION_COOKIE, path="/")
    return response


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
        <p>Private app hosted on your Mac. The iPhone client is the native InvestmentDashboard app, not a Tailscale browser.</p>
        <section><h2>iPhone</h2><ol>
        <li>On the Mac run <code>npm run remote</code> so Flask is on the LAN and advertised over Bonjour.</li>
        <li>Install with <code>npm run iphone:native</code>, or open <code>apple-app/InvestmentDashboard.xcodeproj</code> and Run on the device.</li>
        <li>On the Mac run <code>npm run iphone:pair</code>, then enter the code in the iPhone app.</li>
        <li>Keep this Mac awake on the same Wi-Fi as the iPhone.</li></ol>
        <p>Safari Add to Home Screen remains a fallback only: <code>{escape(dashboard_url)}</code></p></section>
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
    if _operator_only_proxy(path) and not _is_loopback_request():
        return Response(
            '{"error":"This action is only available on the author Mac."}',
            status=403,
            content_type="application/json",
        )
    body = request.get_data(cache=False) if request.method not in {"GET", "HEAD"} else None
    upstream_request = UpstreamRequest(
        _upstream_url(path),
        data=body,
        headers=_request_headers(),
        method=request.method,
    )
    force_content = request.args.get("force") == "1" or "startup" in request.args
    timeout_seconds = (
        CONTENT_REFRESH_TIMEOUT_SECONDS
        if path.startswith("api/content/") or (path.startswith("api/dashboard/refresh") and force_content)
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
