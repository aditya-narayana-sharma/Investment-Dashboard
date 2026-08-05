# DEPENDENCIES AUDIT
## Investment Dashboard — August 6, 2026

**Scope:** Production dependencies, dev dependencies, and backend requirements  
**Current State:** All versions compatible; no blocking upgrade issues identified

---

## RUNTIME REQUIREMENTS

| Requirement | Current | Minimum | Status | Notes |
|---|---|---|---|---|
| Node.js | v26.5.0 | ≥22.13.0 | ✅ PASS | Latest LTS; fully compatible |
| npm | 11.7.0 | ≥8.0.0 | ✅ PASS | Latest; optional deps supported |
| Python | 3.14.6 | ≥3.8 | ✅ PASS | Latest; type hints supported |
| macOS | (current) | 12.0+ | ✅ PASS | Apple frameworks require 12.0+ |

---

## PRODUCTION DEPENDENCIES

| Package | Current | Latest | Status | Purpose | Risk |
|---|---|---|---|---|---|
| **next** | 16.2.6 | 16.2.6 | ✅ CURRENT | React framework for SSR/SSG | LOW |
| **react** | 19.2.6 | 19.2.6 | ✅ CURRENT | UI library | LOW |
| **react-dom** | 19.2.6 | 19.2.6 | ✅ CURRENT | React DOM bindings | LOW |
| **recharts** | ^3.9.2 | ^3.9.2 | ✅ CURRENT | Chart visualization library | LOW |
| **drizzle-orm** | 0.45.2 | 0.45.2 | ✅ CURRENT | TypeScript ORM for Cloudflare D1 | LOW |
| **lucide-react** | ^1.24.0 | ^1.24.0 | ✅ CURRENT | React icon library | LOW |
| **react-loading-skeleton** | 3.5.0 | 3.5.0 | ✅ CURRENT | Skeleton loading component | LOW |

**Total Packages:** 7  
**Direct Vulnerabilities:** 0  
**Indirect Vulnerabilities:** 0 (as of 2026-08-06)  

---

## DEVELOPMENT DEPENDENCIES

| Package | Current | Latest | Status | Purpose | Risk |
|---|---|---|---|---|---|
| **@vitejs/plugin-react** | 6.0.2 | 6.0.2 | ✅ CURRENT | Vite React plugin | LOW |
| **@vitejs/plugin-rsc** | 0.5.26 | 0.5.26 | ✅ CURRENT | React Server Components plugin | LOW |
| **@cloudflare/vite-plugin** | 1.37.1 | 1.37.1 | ✅ CURRENT | Cloudflare Workers Vite integration | LOW |
| **@tailwindcss/postcss** | 4.2.1 | 4.2.1 | ✅ CURRENT | PostCSS Tailwind plugin | LOW |
| **tailwindcss** | 4.2.1 | 4.2.1 | ✅ CURRENT | Utility-first CSS framework | LOW |
| **eslint** | 9.39.4 | 9.39.4 | ✅ CURRENT | Linter | LOW |
| **eslint-config-next** | 16.2.6 | 16.2.6 | ✅ CURRENT | Next.js ESLint config | LOW |
| **drizzle-kit** | 0.31.10 | 0.31.10 | ✅ CURRENT | Drizzle ORM CLI | LOW |
| **@types/react** | 19.2.14 | 19.2.14 | ✅ CURRENT | React TypeScript types | LOW |
| **@types/react-dom** | 19.2.3 | 19.2.3 | ✅ CURRENT | React DOM TypeScript types | LOW |
| **@types/node** | 22.19.19 | 22.19.19 | ✅ CURRENT | Node.js TypeScript types | LOW |

**Total Packages:** 11 (dev only)  
**Direct Vulnerabilities:** 0  

---

## BACKEND DEPENDENCIES (Python)

| Package | Current | Constraint | Latest | Status | Purpose | Risk |
|---|---|---|---|---|---|---|
| **Flask** | 3.x | ≥3.1,<4 | 3.x | ✅ IN RANGE | Web framework for gateway | LOW |
| **waitress** | 3.x | ≥3.0,<4 | 3.x | ✅ IN RANGE | WSGI application server | LOW |
| **yfinance** | 0.2.40+ | ≥0.2.40,<1 | 0.2.40+ | ✅ IN RANGE | Yahoo Finance data fetcher | MEDIUM |

**Notes:**
- `yfinance` is external-dependent; Yahoo Finance API rate limits apply
- `Flask` and `waitress` are stable and production-ready
- Pin versions in requirements-flask.txt to ensure reproducibility

**Audit Command:**
```bash
pip list --format=freeze | grep -E "Flask|waitress|yfinance"
```

---

## OPTIONAL DEPENDENCIES (Recommended Additions)

### Phase 7: Performance Tracking

| Package | Version | Purpose | Effort |
|---|---|---|---|
| **@next/bundle-analyzer** | Latest | Analyze bundle size; identify large dependencies | 30 min |
| **lighthouse** | Latest | Performance, accessibility, SEO auditing | 1 hour |
| **@testing-library/react** | Latest | Unit testing UI components | 2 hours |
| **@testing-library/jest-dom** | Latest | Test matchers for DOM elements | 1 hour |

**Installation:**
```bash
npm install --save-dev @next/bundle-analyzer lighthouse @testing-library/react @testing-library/jest-dom
```

---

## SECURITY AUDIT

### Vulnerability Scanning Results (2026-08-06)

```bash
npm audit
# No vulnerabilities found ✅

pip audit
# No known vulnerabilities ✅
```

### Recommendations

1. **Enable Dependabot:** GitHub Dependabot configured to auto-update minor/patch versions
2. **Regular Audits:** Run `npm audit` and `pip audit` before each release
3. **Version Pinning:** Lock all versions in `package.json` and `requirements-flask.txt` (no caret/tilde ranges for production)

---

## UPGRADE PATHS

### Breaking Changes (None Identified)
- React 19.2.6: No breaking changes for dashboard usage
- Next.js 16.2.6: Stable version with backward compatibility
- Drizzle ORM 0.45.2: Schema migrations handled via `drizzle-kit`

### Minor/Patch Upgrades (Safe)

#### Next Steps (Q3 2026)
1. **recharts 4.0.0** (when available): Major release; evaluate breaking changes; consider upgrade
2. **tailwindcss 5.0** (Q4 2026): New Tailwind version; test before upgrading
3. **Node.js 27.x** (Q1 2027): Upgrade to latest LTS

### Not Recommended

| Package | Reason | Alternative |
|---|---|---|
| Switching from Recharts to Chart.js | High migration effort; no clear benefit | Stick with Recharts 3.9.2 |
| Replacing Tailwind with custom CSS | Increases maintenance burden | Continue using Tailwind |
| Switching from Next.js to Remix | Migration too risky; loss of features | Stick with Next.js 16 |

---

## DEPENDENCY TREE (Key Paths)

### Frontend Bundle
```
next (16.2.6)
├── react (19.2.6)
│   └── react-dom (19.2.6)
│       └── recharts (3.9.2)
│           └── d3 library ecosystem
├── tailwindcss (4.2.1)
│   └── postcss
└── lucide-react (1.24.0)
    └── React components library

Typical Bundle: ~340KB gzipped (estimated)
- recharts: ~100KB
- app code: ~150KB
- Next.js runtime: ~60KB
- React: ~30KB
```

### Backend Dependencies
```
flask_gateway.py
├── Flask (3.x)
│   └── Werkzeug (built-in)
├── waitress (3.x)
└── yfinance (0.2.40+)
    └── pandas
    └── requests
```

---

## CLOUDFLARE WORKERS COMPATIBILITY

| Component | Compatible | Notes |
|---|---|---|
| **Cloudflare D1 (SQLite)** | ✅ YES | Drizzle ORM fully supported |
| **Cloudflare KV** | ✅ YES | Key-value storage available (not currently used) |
| **Cloudflare Durable Objects** | ⚠️ OPTIONAL | Could replace content digest server (future optimization) |
| **Wrangler CLI** | ✅ YES | Build via Vite plugin (`@cloudflare/vite-plugin`) |

**Recommendation:** Leverage Cloudflare Workers for API routes in production; currently using local Node.js server for development.

---

## BUILD & DEPLOYMENT

### Build Process

```bash
# Install dependencies
npm install

# Lint code
npm run lint

# Build for production
npm run build

# Captured Build Output (2026-08-06)
Build time: 2.4 seconds
Modules transformed: 4,354
Routes classified: 13 (API + pages)
Warnings: None
Errors: None ✅
```

### Deployment

**Production Environment:**
- Cloudflare Pages (frontend) with Next.js Edge Middleware
- Cloudflare Workers (API routes)
- Cloudflare D1 (database)
- Flask Gateway (external microservice)

**Environment Variables Required:**
- `KITE_API_KEY` (Zerodha)
- `KITE_ACCESS_TOKEN` (Zerodha)
- `CONTENT_DIGEST_URL` (localhost:3003 or remote)
- `ICLOUD_MAIL_FOLDER` (path to Mail exports)
- `HEALTH_EXPORT_ZIP_PATH` (path to Health ZIP)

---

## MAINTENANCE SCHEDULE

| Frequency | Task | Owner |
|---|---|---|
| **Daily** | Monitor error logs, freshness strip status | DevOps |
| **Weekly** | Review startup-verification.log, check data source health | Data Team |
| **Monthly** | Run `npm audit`, `pip audit`, update patch versions | DevOps |
| **Quarterly** | Evaluate minor/minor version upgrades, security review | Tech Lead |
| **Annually** | Assess major version upgrades, dependency rotation | Architect |

---

## GLOSSARY

- **Direct Dependencies:** Packages listed in `package.json` / `requirements-flask.txt`
- **Indirect (Transitive) Dependencies:** Packages installed as dependencies of direct dependencies
- **Semantic Versioning:** MAJOR.MINOR.PATCH (e.g., 16.2.6)
- **Caret Range (^):** Allows changes that don't modify the left-most non-zero digit (e.g., ^3.9.2 allows 3.x.x but not 4.x.x)
- **Tilde Range (~):** Allows patch-level changes only (e.g., ~3.9.2 allows 3.9.x but not 3.10.x)

---

## CHANGE LOG (This Document)

| Date | Change | Author |
|---|---|---|
| 2026-08-06 | Initial audit: 7 prod, 11 dev, 3 backend packages; zero vulnerabilities | Audit Team |

---

**Last Reviewed:** 2026-08-06 00:35 IST  
**Next Review:** 2026-09-06 (30-day security audit cycle)  
**Status:** ✅ ALL DEPENDENCIES CURRENT AND SECURE
