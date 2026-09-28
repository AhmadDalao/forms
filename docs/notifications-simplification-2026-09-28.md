# Simplified notifications — 28 September 2026

The customer bell opens one accessible panel with a single heading and a flat list. Each item shows its update, form, reason when present, timestamp and one View form action. Historical decisions retain a small Earlier update label. There are no version numbers, nested disclosure panels or per-item Mark as read controls.

Opening an item marks its notification as read through the existing owner-scoped endpoint. The bell and panel count update after the receipt succeeds; failures leave the item unread and allow another attempt. Loading, empty and failed states are explicit. Escape/Close restores focus to the bell. Repeated clicks and closing while loading cannot duplicate or reopen the panel.

The list loads only notifications, without fetching all submissions or the PDF engine. PDF preview is lazy-loaded when requested. The notifications response includes the authenticated user ID so a stale tab cannot display another account's events. No database migration, change to saved submissions or change to review history is required.

Validation: 229 automated tests passed. The isolated browser regression passed Arabic/English desktop/mobile presentation, empty/error/retry states, pagination, read persistence, cross-account denial, PDF preview, failed read retry, keyboard focus, repeated clicks, loading cancellation and expired sessions. See `notifications-simplification-verification.json`. Run `node scripts/notifications-audit.mjs` after `npm run build` to repeat these checks.
