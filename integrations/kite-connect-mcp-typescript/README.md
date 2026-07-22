# Kite Connect MCP Server

TypeScript MCP server for Zerodha Kite Connect v3. It exposes tools for authentication, user profile, margins, holdings, positions, orders, trades, GTTs, instruments, quotes, OHLC/LTP, market depth, historical candles, mutual fund read APIs, and portfolio analytics.

This server uses local `stdio` transport for desktop MCP clients. Secrets are read from environment variables or set in process memory through auth tools. Logs are written to stderr as redacted JSON.

## Status And Safety

- Mutating tools default to `dry_run: true` where Kite supports a request payload preview.
- Equity/F&O order and GTT writes are available only when `dry_run` is explicitly set to `false`.
- Mutual fund order placement is not exposed by Kite Connect; this server implements MF orders, SIPs, holdings, and instruments as read tools.
- This project does not provide investment advice. `kite_get_portfolio_analytics` computes operational portfolio math from Kite holdings and positions only.

## Requirements

- Node.js 20+
- Zerodha Kite Connect app with `api_key` and `api_secret`
- Daily `access_token`, or a fresh `request_token` from the login flow

## Install

```bash
npm install
npm run build
```

Copy `.env.example` to `.env` if you run manually:

```bash
KITE_API_KEY=your_api_key
KITE_API_SECRET=your_api_secret
KITE_ACCESS_TOKEN=optional_daily_access_token
```

Most MCP clients should receive credentials through their MCP server `env` config instead of a checked-in `.env`.

## Authentication Flow

1. Call `kite_auth_login_url` or open:

```text
https://kite.zerodha.com/connect/login?v=3&api_key=YOUR_API_KEY
```

2. Complete login. Kite redirects to your registered redirect URL with `request_token`.
3. Call `kite_auth_generate_session` with `request_token`. The server computes the SHA-256 checksum using `api_key + request_token + api_secret`, exchanges it for an access token, and stores the token in memory.
4. Alternatively, set a known daily token with `kite_auth_set_access_token`.

Kite access tokens expire daily around 6 AM India time by regulatory requirement.

## Claude Desktop Setup

Add this to Claude Desktop's MCP config. On macOS this is usually:

```text
~/Library/Application Support/Claude/claude_desktop_config.json
```

```json
{
  "mcpServers": {
    "kite-connect": {
      "command": "node",
      "args": [
        "/Users/adityasharma/Documents/Codex/2026-07-13/referenced-chatgpt-conversation-this-is-untrusted/dist/index.js"
      ],
      "env": {
        "KITE_API_KEY": "your_api_key",
        "KITE_API_SECRET": "your_api_secret",
        "KITE_ACCESS_TOKEN": "optional_daily_access_token",
        "KITE_RATE_LIMIT_RPS": "3",
        "KITE_LOG_LEVEL": "info"
      }
    }
  }
}
```

Restart Claude Desktop after changing the config.

## Cursor Setup

Create or update `.cursor/mcp.json` in your project or Cursor global MCP settings:

```json
{
  "mcpServers": {
    "kite-connect": {
      "command": "node",
      "args": [
        "/Users/adityasharma/Documents/Codex/2026-07-13/referenced-chatgpt-conversation-this-is-untrusted/dist/index.js"
      ],
      "env": {
        "KITE_API_KEY": "your_api_key",
        "KITE_API_SECRET": "your_api_secret",
        "KITE_ACCESS_TOKEN": "optional_daily_access_token"
      }
    }
  }
}
```

## ChatGPT-Compatible MCP Clients

For any MCP client that supports local stdio servers, configure:

```json
{
  "name": "kite-connect",
  "transport": "stdio",
  "command": "node",
  "args": [
    "/Users/adityasharma/Documents/Codex/2026-07-13/referenced-chatgpt-conversation-this-is-untrusted/dist/index.js"
  ],
  "env": {
    "KITE_API_KEY": "your_api_key",
    "KITE_API_SECRET": "your_api_secret",
    "KITE_ACCESS_TOKEN": "optional_daily_access_token"
  }
}
```

If your host expects a command string instead of `command` plus `args`, use:

```bash
node /Users/adityasharma/Documents/Codex/2026-07-13/referenced-chatgpt-conversation-this-is-untrusted/dist/index.js
```

## Tool Coverage

Authentication:

- `kite_auth_login_url`
- `kite_auth_generate_session`
- `kite_auth_set_access_token`
- `kite_auth_clear_session`
- `kite_auth_logout`

User and portfolio:

- `kite_get_profile`
- `kite_get_margins`
- `kite_get_holdings`
- `kite_get_holding_auctions`
- `kite_get_positions`
- `kite_convert_position`
- `kite_get_portfolio_analytics`

Orders and trades:

- `kite_place_order`
- `kite_modify_order`
- `kite_cancel_order`
- `kite_list_orders`
- `kite_get_order_history`
- `kite_list_trades`
- `kite_get_order_trades`

GTT:

- `kite_place_gtt`
- `kite_list_gtts`
- `kite_get_gtt`
- `kite_modify_gtt`
- `kite_delete_gtt`

Market data:

- `kite_list_instruments`
- `kite_get_quotes`
- `kite_get_ohlc`
- `kite_get_ltp`
- `kite_get_market_depth`
- `kite_get_historical_data`

Mutual funds:

- `kite_list_mf_orders`
- `kite_get_mf_order`
- `kite_list_mf_sips`
- `kite_get_mf_holdings`
- `kite_list_mf_instruments`

## Example Tool Calls

Fetch holdings:

```json
{}
```

Tool: `kite_get_holdings`

Fetch quotes:

```json
{
  "instruments": ["NSE:INFY", "NSE:RELIANCE"]
}
```

Tool: `kite_get_quotes`

Preview a regular CNC limit buy order:

```json
{
  "variety": "regular",
  "exchange": "NSE",
  "tradingsymbol": "INFY",
  "transaction_type": "BUY",
  "quantity": 1,
  "product": "CNC",
  "order_type": "LIMIT",
  "price": 1500,
  "validity": "DAY",
  "dry_run": true
}
```

Tool: `kite_place_order`

Place the order after review:

```json
{
  "variety": "regular",
  "exchange": "NSE",
  "tradingsymbol": "INFY",
  "transaction_type": "BUY",
  "quantity": 1,
  "product": "CNC",
  "order_type": "LIMIT",
  "price": 1500,
  "validity": "DAY",
  "dry_run": false
}
```

Preview a single-leg GTT:

```json
{
  "type": "single",
  "condition": {
    "exchange": "NSE",
    "tradingsymbol": "INFY",
    "trigger_values": [1450],
    "last_price": 1500
  },
  "orders": [
    {
      "exchange": "NSE",
      "tradingsymbol": "INFY",
      "transaction_type": "BUY",
      "quantity": 1,
      "order_type": "LIMIT",
      "product": "CNC",
      "price": 1451
    }
  ],
  "dry_run": true
}
```

Tool: `kite_place_gtt`

Fetch historical candles:

```json
{
  "instrument_token": 408065,
  "interval": "day",
  "from": "2026-01-01 00:00:00",
  "to": "2026-07-13 23:59:59",
  "continuous": false,
  "oi": false
}
```

Tool: `kite_get_historical_data`

## Development

```bash
npm run typecheck
npm run build
npm run dev
```

Inspect with MCP Inspector:

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

## Environment Variables

- `KITE_API_KEY`: Kite Connect API key.
- `KITE_API_SECRET`: Kite Connect API secret, needed for `request_token` exchange.
- `KITE_ACCESS_TOKEN`: Optional daily access token.
- `KITE_BASE_URL`: Defaults to `https://api.kite.trade`.
- `KITE_RATE_LIMIT_RPS`: Defaults to `3`. Lower this if you hit rate limits.
- `KITE_REQUEST_TIMEOUT_MS`: Defaults to `15000`.
- `KITE_LOG_LEVEL`: `debug`, `info`, `warn`, or `error`.

## Official References

- Zerodha Kite Connect v3 docs: https://kite.trade/docs/connect/v3/
- MCP specification: https://modelcontextprotocol.io/specification/latest
- MCP TypeScript SDK: https://github.com/modelcontextprotocol/typescript-sdk
