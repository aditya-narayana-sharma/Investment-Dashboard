from __future__ import annotations

import io
import tempfile
import unittest
from email.message import Message
from pathlib import Path
from unittest.mock import patch

import flask_gateway


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


if __name__ == "__main__":
    unittest.main()
