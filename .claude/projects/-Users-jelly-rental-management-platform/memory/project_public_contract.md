---
name: project-public-contract
description: Public /create-contract route — no-auth contract creator with OneMap postcode lookup, signature drawing, localStorage draft, PDF export, WhatsApp share
metadata:
  type: project
---

Public contract creation page added (2026-06-10).

**Why:** User wanted incognito-mode access so tenants/agents can create contracts without logging in.

**How to apply:** No backend calls on this page — pure client-side. If auth logic changes, this page is unaffected.

**Key files:**
- `src/create-contract.html` — HTML template (no webpack JS bundle needed at template level; Bootstrap CDN)
- `src/js/create-contract.js` — entry point, `PublicContractCreator` class
- `src/js/components/contract-clauses.js` — **shared** clause text/utils for both authenticated and incognito flows

**Shared clause sync:** `contract-clauses.js` is the single source of truth for all contract clause wording. Both `contract-management.js` (authenticated) and `create-contract.js` (incognito) import `getSection1BaseClauseTexts` and `buildSection2Clauses` from it. Change wording only in `contract-clauses.js`.

**Routing:**
- Netlify: `/create-contract` → `create-contract.html` (force=true)
- webpack devServer: `/create-contract` → `create-contract.html`
- URL: `https://<app>/create-contract` (no hash needed)

**Features:**
- Singapore postcode → OneMap API address lookup
- Unit number input
- Signature: draw on canvas OR upload image
- Multiple Tenant B rows (add/remove)
- Auto-save to localStorage on every input
- Export PDF with NotoSerif font (same quality as authenticated version)
- Web Share API (mobile) / WhatsApp Web fallback (desktop)
