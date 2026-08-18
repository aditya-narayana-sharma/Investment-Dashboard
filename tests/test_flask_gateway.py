from __future__ import annotations

import io
import json
import os
import tempfile
import unittest
from datetime import datetime
from email.message import Message
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import flask_gateway


def _request_header(upstream_request, name: str) -> str | None:
    target = name.lower()
    if hasattr(upstream_request, "header_items"):
        for key, value in upstream_request.header_items():
            if key.lower() == target:
                return value
    headers = getattr(upstream_request, "headers", {})
    if hasattr(headers, "items"):
        for key, value in headers.items():
            if str(key).lower() == target:
                return value
    return None


class FakeUpstream:
    def __init__(self, body: bytes, status: int = 200, headers: dict[str, str] | None = None):
        self._body = io.BytesIO(body)
        self.status = status
        self.headers = Message()
        for key, value in (headers or {}).items():
            self.headers[key] = value

    def read(self) -> bytes:
        return self._body.read()

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False


class FlaskGatewayTests(unittest.TestCase):
    def setUp(self):
        flask_gateway.app.config.update(TESTING=True)
        self.client = flask_gateway.app.test_client()
        flask_gateway.PAIRING_CODES.clear()

    @patch("flask_gateway.urlopen")
    def test_proxies_dashboard_query_and_headers(self, mocked_urlopen):
        mocked_urlopen.return_value = FakeUpstream(
            b"<html>dashboard</html>",
            headers={"Content-Type": "text/html", "Set-Cookie": "kite_session=abc; HttpOnly; SameSite=Strict"},
        )
        response = self.client.get("/?view=sectors", headers={"Cookie": "kite_session=abc"})
        upstream_request = mocked_urlopen.call_args.args[0]

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["X-Portfolio-Gateway"], "Flask")
        self.assertIn("HttpOnly", response.headers["Set-Cookie"])
        self.assertEqual(upstream_request.full_url, "http://127.0.0.1:3000/?view=sectors")

    @patch("flask_gateway.urlopen")
    def test_preserves_api_post_body(self, mocked_urlopen):
        mocked_urlopen.return_value = FakeUpstream(b'{"ok":true}', headers={"Content-Type": "application/json"})
        response = self.client.post("/api/report-pdf", data=b'{"pages":[]}', content_type="application/json")
        upstream_request = mocked_urlopen.call_args.args[0]

        self.assertEqual(response.status_code, 200)
        self.assertEqual(upstream_request.method, "POST")
        self.assertEqual(upstream_request.data, b'{"pages":[]}')

    @patch("flask_gateway.urlopen")
    def test_proxies_llm_complete_post(self, mocked_urlopen):
        mocked_urlopen.return_value = FakeUpstream(
            b'{"ok":true,"provider":"OpenAI","text":"draft"}',
            headers={"Content-Type": "application/json"},
        )
        body = b'{"task":"composite","prompt":"top picks"}'
        response = self.client.post("/api/llm/complete", data=body, content_type="application/json")
        upstream_request = mocked_urlopen.call_args.args[0]

        self.assertEqual(response.status_code, 200)
        self.assertEqual(upstream_request.method, "POST")
        self.assertEqual(upstream_request.full_url, "http://127.0.0.1:3000/api/llm/complete")
        self.assertEqual(upstream_request.data, body)
        self.assertEqual(response.headers["X-Portfolio-Gateway"], "Flask")
        self.assertEqual(_request_header(upstream_request, "X-Stratji-Local-Operator"), "1")

    @patch("flask_gateway.urlopen")
    def test_lan_cannot_post_llm_complete(self, mocked_urlopen):
        response = self.client.post(
            "/api/llm/complete",
            data=b'{"task":"composite","prompt":"top picks"}',
            content_type="application/json",
            environ_base={"REMOTE_ADDR": "100.64.1.9"},
        )
        mocked_urlopen.assert_not_called()
        self.assertEqual(response.status_code, 403)

        with tempfile.TemporaryDirectory() as directory:
            with patch.object(flask_gateway, "HEALTH_PAIRINGS_PATH", Path(directory) / "pairings.json"):
                code = self.client.post("/_health/pair/code").get_json()["code"]
                token = self.client.post("/_health/pair", json={
                    "code": code,
                    "installId": "iphone-llm-install",
                    "label": "LAN iPhone",
                }, environ_base={"REMOTE_ADDR": "100.64.1.9"}).get_json()["token"]
                paired = self.client.post(
                    "/api/llm/complete",
                    data=b'{"task":"composite","prompt":"top picks"}',
                    content_type="application/json",
                    headers={"Authorization": f"Bearer {token}"},
                    environ_base={"REMOTE_ADDR": "100.64.1.9"},
                )
        mocked_urlopen.assert_not_called()
        self.assertEqual(paired.status_code, 403)

    @patch("flask_gateway.urlopen")
    def test_strips_spoofed_operator_header_on_lan(self, mocked_urlopen):
        mocked_urlopen.return_value = FakeUpstream(b"<html>ok</html>", headers={"Content-Type": "text/html"})
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(flask_gateway, "HEALTH_PAIRINGS_PATH", Path(directory) / "pairings.json"):
                code = self.client.post("/_health/pair/code").get_json()["code"]
                token = self.client.post("/_health/pair", json={
                    "code": code,
                    "installId": "iphone-spoof-install",
                    "label": "LAN iPhone",
                }, environ_base={"REMOTE_ADDR": "100.64.1.9"}).get_json()["token"]
                self.client.get(
                    "/",
                    headers={
                        "Authorization": f"Bearer {token}",
                        "X-Stratji-Local-Operator": "1",
                    },
                    environ_base={"REMOTE_ADDR": "100.64.1.9"},
                )
        upstream_request = mocked_urlopen.call_args.args[0]
        self.assertIsNone(_request_header(upstream_request, "X-Stratji-Local-Operator"))
        self.assertEqual(_request_header(upstream_request, "X-Forwarded-For"), "100.64.1.9")

    @patch("flask_gateway.urlopen")
    def test_health_reports_upstream_state(self, mocked_urlopen):
        mocked_urlopen.return_value = FakeUpstream(b"ok")
        response = self.client.get("/_flask/health")
        payload = response.get_json()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload["status"], "ok")
        self.assertEqual(payload["app"], "Portfolio Intelligence")
        self.assertEqual(payload["gateway"], "flask")

    def test_rejects_health_snapshot_without_token(self):
        snapshot = {
            "schemaVersion": 1,
            "status": "live",
            "source": "Apple Health",
            "dataDate": "2026-07-18",
            "capturedAt": "2026-07-19T08:00:00Z",
            "message": "Latest completed-day HealthKit aggregates.",
            "categories": [{
                "name": "Activity",
                "note": "Apple Health · 18 Jul",
                "tone": "green",
                "metrics": [{"label": "Steps", "value": "10,000", "averages": {} }],
            }],
            "sources": [{"source": "Apple Health / HealthKit", "status": "Synced", "detail": "Completed day", "tone": "green"}],
        }
        with tempfile.TemporaryDirectory() as directory, patch.object(flask_gateway, "HEALTH_SNAPSHOT_PATH", Path(directory) / "health.json"):
            stored = self.client.post("/_health/snapshot", json=snapshot)
        self.assertEqual(stored.status_code, 401)

    def test_persists_and_returns_normalized_health_snapshot(self):
        snapshot = {
            "schemaVersion": 1,
            "status": "live",
            "source": "Apple Health",
            "dataDate": "2026-07-18",
            "capturedAt": "2026-07-19T08:00:00Z",
            "message": "Latest completed-day HealthKit aggregates.",
            "categories": [{
                "name": "Activity",
                "note": "Apple Health · 18 Jul",
                "tone": "green",
                "metrics": [{"label": "Steps", "value": "10,000", "averages": {} }],
            }],
            "sources": [{"source": "Apple Health / HealthKit", "status": "Synced", "detail": "Completed day", "tone": "green"}],
        }
        with tempfile.TemporaryDirectory() as directory:
            with (
                patch.object(flask_gateway, "HEALTH_SNAPSHOT_PATH", Path(directory) / "health.json"),
                patch.object(flask_gateway, "HEALTH_TOKEN", "portfolio-test-admin-token"),
                patch.object(flask_gateway, "_current_health_target", return_value=SimpleNamespace(
                    target_date=datetime.strptime("2026-07-18", "%Y-%m-%d").date(),
                    policy="D_MINUS_1",
                    label="D-1",
                )),
            ):
                stored = self.client.post(
                    "/_health/snapshot",
                    json=snapshot,
                    headers={"Authorization": "Bearer portfolio-test-admin-token"},
                )
                loaded = self.client.get("/_health/snapshot")

        self.assertEqual(stored.status_code, 201)
        self.assertEqual(loaded.status_code, 200)
        self.assertEqual(loaded.get_json()["dataDate"], "2026-07-18")
        self.assertEqual(loaded.get_json()["targetDate"], "2026-07-18")
        self.assertEqual(loaded.get_json()["targetPolicy"], "D_MINUS_1")
        self.assertEqual(loaded.headers["Cache-Control"], "no-store, max-age=0")

    def test_pairs_installation_and_accepts_keychain_token(self):
        snapshot = {
            "schemaVersion": 1,
            "status": "live",
            "source": "Apple Health",
            "dataDate": "2026-07-18",
            "capturedAt": "2026-07-19T08:00:00Z",
            "message": "Latest completed-day HealthKit aggregates.",
            "categories": [{
                "name": "Activity",
                "note": "Apple Health · 18 Jul",
                "tone": "green",
                "metrics": [{"label": "Steps", "value": "10,000", "averages": {}}],
            }],
            "sources": [{"source": "Apple Health / HealthKit", "status": "Synced", "detail": "Completed day", "tone": "green"}],
        }
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            with (
                patch.object(flask_gateway, "HEALTH_PAIRINGS_PATH", root / "pairings.json"),
                patch.object(flask_gateway, "HEALTH_SNAPSHOT_PATH", root / "health.json"),
            ):
                code_response = self.client.post("/_health/pair/code")
                self.assertEqual(code_response.status_code, 201)
                code = code_response.get_json()["code"]

                paired = self.client.post("/_health/pair", json={
                    "code": code,
                    "installId": "iphone-test-install",
                    "label": "Test iPhone",
                })
                self.assertEqual(paired.status_code, 201)
                token = paired.get_json()["token"]
                self.assertNotEqual(token, flask_gateway.HEALTH_TOKEN)

                stored = self.client.post(
                    "/_health/snapshot",
                    json=snapshot,
                    headers={"Authorization": f"Bearer {token}"},
                )
                self.assertEqual(stored.status_code, 201)

                revoked = self.client.delete(
                    "/_health/pair/iphone-test-install",
                    headers={"Authorization": f"Bearer {token}"},
                    environ_base={"REMOTE_ADDR": "10.0.0.7"},
                )
                self.assertEqual(revoked.status_code, 200)
                rejected = self.client.post(
                    "/_health/snapshot",
                    json=snapshot,
                    headers={"Authorization": f"Bearer {token}"},
                )
                self.assertEqual(rejected.status_code, 401)

    def test_rejects_remote_pairing_code_generation_without_admin_token(self):
        response = self.client.post("/_health/pair/code", environ_base={"REMOTE_ADDR": "10.0.0.7"})
        self.assertEqual(response.status_code, 401)

    @patch("flask_gateway.urlopen")
    def test_lan_clients_need_pairing_token_for_private_routes(self, mocked_urlopen):
        mocked_urlopen.return_value = FakeUpstream(b'{"holdings":[]}', headers={"Content-Type": "application/json"})
        blocked = self.client.get("/api/kite/snapshot", environ_base={"REMOTE_ADDR": "192.168.1.40"})
        self.assertEqual(blocked.status_code, 401)

        health = self.client.get("/_flask/health", environ_base={"REMOTE_ADDR": "192.168.1.40"})
        self.assertIn(health.status_code, {200, 503})

        with tempfile.TemporaryDirectory() as directory:
            with patch.object(flask_gateway, "HEALTH_PAIRINGS_PATH", Path(directory) / "pairings.json"):
                code = self.client.post("/_health/pair/code").get_json()["code"]
                token = self.client.post("/_health/pair", json={
                    "code": code,
                    "installId": "iphone-lan-install",
                    "label": "LAN iPhone",
                }, environ_base={"REMOTE_ADDR": "192.168.1.40"}).get_json()["token"]
                allowed = self.client.get(
                    "/api/kite/snapshot",
                    headers={"Authorization": f"Bearer {token}"},
                    environ_base={"REMOTE_ADDR": "192.168.1.40"},
                )
                self.assertEqual(allowed.status_code, 200)
                self.client.set_cookie("stratji_device", token)
                cookie = self.client.get(
                    "/api/kite/snapshot",
                    environ_base={"REMOTE_ADDR": "192.168.1.40"},
                )
                self.assertEqual(cookie.status_code, 200)

    def test_rejects_malformed_or_future_health_dates(self):
        base = {
            "schemaVersion": 1,
            "source": "Apple Health",
            "capturedAt": "2026-07-19T08:00:00Z",
            "categories": [{
                "name": "Activity",
                "metrics": [{"label": "Steps", "value": "10,000"}],
            }],
        }
        with patch.object(flask_gateway, "HEALTH_TOKEN", "portfolio-test-admin-token"):
            malformed = self.client.post(
                "/_health/snapshot",
                json={**base, "dataDate": "not-a-date"},
                headers={"Authorization": "Bearer portfolio-test-admin-token"},
            )
            future = self.client.post(
                "/_health/snapshot",
                json={**base, "dataDate": "2999-01-01"},
                headers={"Authorization": "Bearer portfolio-test-admin-token"},
            )
        self.assertEqual(malformed.status_code, 400)
        self.assertEqual(future.status_code, 400)

    def test_author_session_disabled_without_auth0_domain(self):
        with patch.dict(os.environ, {"AUTH0_DOMAIN": ""}, clear=False):
            response = self.client.get("/_auth/session")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["status"], "disabled")
        self.assertFalse(response.get_json()["authenticated"])

    def test_author_session_requires_verified_access_token(self):
        env = {"AUTH0_DOMAIN": "example.auth0.com", "AUTH0_SESSION_SECRET": "test-secret"}
        with patch.dict(os.environ, env, clear=False):
            with patch.object(flask_gateway, "_verify_auth0_access_token", return_value=None):
                denied = self.client.post("/_auth/session", json={"accessToken": "bad"})
            self.assertEqual(denied.status_code, 401)
            with patch.object(
                flask_gateway,
                "_verify_auth0_access_token",
                return_value={"sub": "auth0|1", "email": "owner@example.com", "name": "Aditya"},
            ):
                created = self.client.post("/_auth/session", json={"accessToken": "good"})
            self.assertEqual(created.status_code, 200)
            self.assertEqual(created.get_json()["email"], "owner@example.com")
            self.assertIn("HttpOnly", created.headers.get("Set-Cookie", ""))
            session = self.client.get("/_auth/session")
            self.assertEqual(session.status_code, 200)
            self.assertTrue(session.get_json()["authenticated"])
            logout = self.client.post("/_auth/logout")
            self.assertEqual(logout.status_code, 200)
            missing = self.client.get("/_auth/session")
            self.assertEqual(missing.status_code, 401)

    def test_startup_progress_returns_json_snapshot(self):
        payload = {
            "schemaVersion": 1,
            "stage": "calendar",
            "state": "start",
            "label": "Refreshing Apple Calendar…",
            "fraction": 0,
            "completed": ["service", "kite", "mail"],
            "failed": [],
            "percent": 0.2727,
            "updatedAt": "2026-08-17T19:50:00Z",
        }
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "startup-progress.json"
            path.write_text(json.dumps(payload), encoding="utf-8")
            with patch.object(flask_gateway, "STARTUP_PROGRESS_PATH", path):
                response = self.client.get("/_startup/progress")
        self.assertEqual(response.status_code, 200)
        body = response.get_json()
        self.assertEqual(body["stage"], "calendar")
        self.assertEqual(body["completed"], ["service", "kite", "mail"])
        self.assertEqual(response.headers["Cache-Control"], "no-store, max-age=0")

    def test_startup_progress_missing_file_is_unknown_not_error(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(flask_gateway, "STARTUP_PROGRESS_PATH", Path(directory) / "missing.json"):
                response = self.client.get("/_startup/progress")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["status"], "unknown")

    def test_author_session_rejects_non_author_email(self):
        env = {
            "AUTH0_DOMAIN": "example.auth0.com",
            "AUTH0_AUTHOR_EMAIL": "owner@example.com",
            "AUTH0_SESSION_SECRET": "test-secret",
        }
        with patch.dict(os.environ, env, clear=False):
            with patch.object(
                flask_gateway,
                "_verify_auth0_access_token",
                return_value={"sub": "auth0|2", "email": "other@example.com"},
            ):
                response = self.client.post("/_auth/session", json={"accessToken": "good"})
        self.assertEqual(response.status_code, 403)


if __name__ == "__main__":
    unittest.main()
