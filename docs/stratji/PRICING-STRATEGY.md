# Stratji Pricing Strategy

**Status:** locked commercial intent. Labels: **AS-BUILT** (no paid gate today) / **TARGET**.

## 1. List prices (TARGET, annual INR)

| Tier | Price | Included |
| --- | --- | --- |
| **Basic** | ₹5,000 / year | Installer, Portfolio Overview I-1–I-4 (Kite BYOK), Sectoral S-1+S-2 (yfinance), freshness audit, 1 Mac, GitHub issues |
| **Pro** | ₹9,999 / year | Basic + Market Intelligence M-1–M-4, Health H-1–H-3, S-3 Decision Lab, PDF brief, wizard, email support |
| **Ultra** | ₹19,999 / year | Pro + Algorithm Canvas, Strategies library, Streak export checklist, 2 Macs, priority support |

Early adopter: **20% off first year**, first 100 licenses. Annual only at launch.

yfinance remains **free for all tiers**. Paid Kite MD is never required for Sectoral Analytics.

## 2. What is not sold

- Hosted Kite / Mail / Health keys
- Black-box third-party strategies
- Cloud data plane
- Unattended Stratji-core auto-trade

## 3. Entitlement (TARGET P1, not this slice’s payment stack)

- Local license file (`~/Library/Application Support/Stratji/license.json`) plus optional `STRATJI_LICENSE_KEY`
- v1 honor + well-formed key prefix (`stratji-pro-…` / `stratji-ultra-…`); operator tier override in Settings
- 7-day offline grace and signed JWT from stratji.co.in remain TARGET
- Secrets never leave the Mac
- Integration Page is **visible to all tiers**; connectors and workspaces behind it are gated

v1 does **not** implement Razorpay, Stripe, or a license server.

## 4. GitHub relationship

Source-available commercial license (visible source; not necessarily OSI-free). Paid license funds support and Pro studio. Cloning the repo without a key is a TARGET compliance choice for P7, not a reason to ship secrets.
