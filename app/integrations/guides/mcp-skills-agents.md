# MCP, skills, and ops agents

- Kite Go MCP is runtime, not a dashboard rewrite. Point `broker.mcpUrl` at loopback.
- Notion can use a user MCP or an on-device token under `artifacts/private/`.
- In-repo agents: `.cursor/agents/stratji-audit.md`, `stratji-rca.md`, `stratji-feature-monitor.md`, `stratji-data-refresh.md`.
- Matching skill: `.cursor/skills/stratji-integrations-onboard/SKILL.md`.

Data Refresh is the only snapshot writer. Audit is read-only. Feature Monitoring compares this Visual-Overhaul gap matrix to shipped code. RCA writes `Plans/RCA-YYYY-MM-DD-<slug>.md`.
