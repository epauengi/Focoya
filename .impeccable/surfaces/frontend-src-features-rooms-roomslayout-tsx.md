---
version: 1
slug: "frontend-src-features-rooms-roomslayout-tsx"
primary_target: "frontend/src/features/rooms/RoomsLayout.tsx"
related_targets: ["frontend/src/features/rooms/ExplorePage.tsx","frontend/src/features/rooms/RoomPreviewPage.tsx","frontend/src/features/rooms/FocusRoomPage.tsx","frontend/src/features/rooms/RoomSettings.tsx"]
---

# Rooms integration

Mode: Operate. Scope: port the existing FE TEST visual world into frontend React; preserve Landing/Auth. Audience: students choosing a room then focusing. Mock data and temporary client state only; backend excluded. Use existing assets, Manrope, React Router and native dialog/fullscreen; no dependency additions.

## Direction contract

THESIS: The supplied FE TEST is visual authority, not a new identity exercise. Preserve its room-first gallery, preview and immersive focus scene rather than turning it into a dashboard.

OWN-WORLD: Pastel image-backed Explore, blue selection controls, translucent light gallery surfaces, photographic full-bleed focus scenes and dark settings. Reuse the six room records and supplied artwork; use existing self-hosted Manrope for consistency with frontend.

STORY: Visitors filter and preview a sample room, enter a local focus session, use timer/tasks, adjust wallpaper, and inspect clearly labelled demonstration statistics. Existing Landing/Auth stay intact.

FIRST VIEWPORT: Explore has a compact top navigation, title/search, theme chips and three-column six-room grid. Preview pairs scene with details and one join action. Focus centers clock over scene; tasks and tools anchor lower corners. Mobile stacks gallery/preview and keeps controls reachable.

FORM: User-pinned FE TEST composition; no direction roll. Signature transition: gallery artwork becomes the full focus environment. seed: none (user-pinned reference).

FINISH: unreviewed and undocumented unfinished; build ends finish review, verdict, DESIGN.md, and shipping raster carrying provenance

Constraints: all room counts/statistics marked illustrative; no fake login, network requests, audio, realtime, XP or persistence claims. State clears on reload. Not-found, no-results, disabled and keyboard states included.
