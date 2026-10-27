# Rooms integration checks

Reference: `FE TEST/`; scope: `frontend/src/features/rooms/` and route wiring. Landing/Auth/backend unchanged. No dependency additions.

## Automated acceptance

Independent verifier: `npm run build`, `npm run lint`, `npm run test:rooms` in `frontend/`, all exit 0. Node v24.14.1 used; `test:rooms` imports TypeScript through Node's type stripping.

## Browser checks performed

Local Vite URL: `http://127.0.0.1:5174`.

- Explore: six rooms; Nature filter returns two; unmatched search shows empty state; reset restores six and clears URL filters.
- Preview: artwork/details/slots/join render.
- Focus: 25:00 decrements to 24:59; pause holds; reset restores 25:00; short mode starts at 05:00. Accelerated browser-clock check reaches 00:00, manual restart restores 05:00; auto-start moves short break to running 25:00 focus. Temporary `Date.now` override restored after check.
- Tasks: add, complete, delete verified. Mobile footer fits viewport (document width 390px; tools right edge 374.4px).
- Settings: wallpaper updates room without closing dialog; notification/auto-start toggles update ARIA state; account name save updates greeting. Modal cancel event restores focus to account summary; close restores focused room-settings trigger.
- Detector: `impeccable detect --json frontend/src/features/rooms` returned `[]`.

## Captures

All images opened and visually checked after capture; loaded artwork, no blank regions.

- `desktop.png`: Explore, 1440×1000.
- `mobile.png`: Explore, 390×844, first viewport.
- `preview-desktop.png`: Preview, 1440×1000.
- `focus-desktop.png`, `focus-mobile.png`: Focus/live clock at the same viewport sizes.
- `settings-desktop.png`, `settings-mobile.png`: Settings/theme at the same viewport sizes.

## Independent final review

Disposition: **ship**. No material findings in the inspected room surfaces.

- My Rooms selection enables join; joins `/rooms/2`.
- Invalid preview/focus IDs render useful not-found states.
- Explore, My Rooms, Preview and Focus: no horizontal page overflow at widths 390px and 768px.
- Settings theme/statistics/account/help panels switch without horizontal clipping; scroll containers remain usable.
- `/dashboard` without a demo session redirects to `/login`; existing demo login reaches `/rooms`.
- Modal cancel unmounts the dialog and restores focus to its visible trigger. Opening Settings from the account menu restores focus to the summary after close.

Code-review fixes verified: local task ID counter avoids `crypto.randomUUID` failures on insecure LAN HTTP; account-menu summary receives focus before menu collapse.

Native physical Escape/focus-trap, real fullscreen permissions, and screen-reader announcements are not established by synthetic browser events. Audio, presence, XP, statistics sync and persistence intentionally not implemented; room counts/statistics marked demo.
