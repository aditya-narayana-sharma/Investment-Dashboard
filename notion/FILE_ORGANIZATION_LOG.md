# File Organization Log

## 19 July 2026

The project was consolidated into one clearly named GitHub workspace while
preserving the active dashboard Git history and keeping the production Go Kite
MCP server as an adjacent dependency.

| Previous location/name | Canonical location/name | Notes |
|---|---|---|
| `.../Documents/Codex/.../dashboard` | `Documents/GitHub/Investment Dashboard` | Main dashboard repository and service root |
| `Documents/GitHub/Dash` | `Investment Dashboard/apple-app/InvestmentDashboard` | Native app source; Xcode project and targets renamed |
| `Dash.xcodeproj` | `InvestmentDashboard.xcodeproj` | Clear product-oriented Xcode name |
| `Dash`, `DashTests`, `DashUITests` | `InvestmentDashboard`, `InvestmentDashboardTests`, `InvestmentDashboardUITests` | Source and test groups renamed consistently |
| Outer `kite-connect-mcp-server` TypeScript prototype | `Investment Dashboard/integrations/kite-connect-mcp-typescript` | Preserved as a reference integration |
| Outer `outputs/` reports | `Investment Dashboard/artifacts/reports` | Historical deliverables retained |
| `Documents/GitHub/kite-mcp-server` | Unchanged adjacent repository | Active Go MCP runtime; not duplicated |

Generated dependency and build directories such as `node_modules`, `.vinext`,
`.venv-flask`, `dist`, and Xcode DerivedData are not source artifacts and are
recreated by setup/build commands in the canonical workspace.
