# Kite Connect and MCP

Kite is the only live broker adapter. Tokens never belong in `integrations.json`.

1. Keep the Flask gateway and `scripts/run-dashboard-service.sh` on loopback.
2. Authenticate through `/api/kite/login`. The access token stays in the Kite session cookie/store.
3. Optional: run the adjacent Go Kite MCP on `http://127.0.0.1:8080/mcp` and set `broker.mcpUrl`.
4. Live writes (order, GTT, alert) require an explicit reviewed ticket and typed confirmation.
5. Paper sinks remain `submitted: false`.

Test from Integrations → Kite → Test. A missing session is `auth_required`, not a fabricated snapshot.
