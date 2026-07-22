# Investment Dashboard Project Summary

## Purpose

Investment Dashboard is a private macOS and iPhone portfolio intelligence app.
It combines live Zerodha Kite portfolio state, Axis Research and newsletter
content, sector and earnings analysis, PDF reporting, and a private health and
wellness workspace.

## Canonical Location

`/Users/adityasharma/Documents/GitHub/Investment Dashboard`

## Runtime

- Vinext dashboard: `http://127.0.0.1:3000`
- Flask gateway for Mac: `http://localhost:5050`
- Private Tailscale access: `https://adis-mbp.tailfd8d7f.ts.net`
- Kite MCP: adjacent Go repository at `../kite-mcp-server`
- Content digest: `http://127.0.0.1:3003`

## Applications

- Web dashboard and report renderer in `app/`
- Native iOS/macOS wrapper in `apple-app/InvestmentDashboard.xcodeproj`
- macOS service and refresh tooling in `scripts/`

## Data Handling

The Flask gateway and Vinext server remain bound to localhost. Tailscale Serve
provides encrypted tailnet-only remote access. Kite credentials, Apple Mail,
podcast, and health data remain on the Mac.
