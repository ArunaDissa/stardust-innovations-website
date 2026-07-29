# Security Log — stardust-innovations.com

Running record of security reviews for every phase of this site, per Stardust's
"security at every phase" policy.

---

## 2026-07-29 — Next-Generation Universe redesign (branch `feat/next-gen-universe`)

**Scope reviewed:** full redesign — `index.html`, `universe.css`, `universe.js`, `vendor/three.module.min.js`.

### Architecture decisions made for security

| Decision | Rationale |
|---|---|
| No AI backend for the guide orb (scripted responses only) | An LLM API key can never be safely embedded in a static public site — anyone could extract it and run up costs. The orb honestly tells visitors it is scripted. Real AI requires a server-side proxy (future phase). |
| Three.js **vendored locally** (`vendor/three.module.min.js`, v0.160.0 from unpkg) | No runtime dependency on a third-party CDN; eliminates CDN-compromise / supply-chain injection at page load. Pinned exact version. |
| Ambient audio generated procedurally via WebAudio | No third-party audio assets or hosts. |
| Visitor "constellation memory" in `localStorage` only | No cookies, no analytics, no tracking, no data leaves the device. Wrapped in try/catch for private-browsing modes. |
| No forms posting data anywhere | Contact is `mailto:` links only — no endpoint to attack, no data collected. Orb chat input is processed entirely in-browser against regex rules. |

### Checks performed

- **XSS:** all user-controlled input (orb chat) is rendered with `textContent`, never `innerHTML`. `innerHTML` is used only with static, developer-authored strings (zone labels, chips). Orb input capped at 200 chars.
- **External links:** all `target="_blank"` links carry `rel="noopener"`.
- **Third-party requests at runtime:** Google Fonts only (same as previous site version). Everything else is same-origin.
- **Secrets:** none present in the repo (static site, no keys, no tokens). Verified by review.
- **Deep links:** location hash is validated against a fixed allowlist of zone ids before use; never interpolated into DOM/HTML.
- **DoS/perf:** particle counts capped by device class; pixel ratio capped at 2; animation paused when tab hidden.
- **Legal surface preserved:** `privacy.html` and `terms.html` untouched at their original URLs (app-store compliance links remain valid).

### Known accepted risks

- Google Fonts CDN remains a third-party request (carried over from previous design). Could be self-hosted in a future pass.
- `vendor/three.module.min.js` must be re-pinned/updated manually if a security advisory is ever published for three.js (r160).

### Future-phase requirements (recorded now)

- If the guide orb is upgraded to real AI: API calls MUST go through a server-side proxy (e.g. Supabase Edge Function) with rate limiting; key stored as server secret; input/output filtered.
- If any form is ever added: needs CSRF-safe endpoint, validation, and rate limiting.
