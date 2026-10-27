---
name: Focoya
description: Existing Landing/Auth identity plus the FE TEST room interface.
colors:
  brand-primary: "#2563EB"
  brand-text: "#15243B"
  brand-surface: "#FFFFFF"
  rooms-blue: "#1D4ED8"
  rooms-ink: "#151B29"
  rooms-muted: "#4C566C"
  rooms-ground: "#EEF0FB"
  rooms-card: "#FFFFFFA3"
  rooms-line: "#FFFFFFB3"
  focus-ground: "#121026"
  settings-ground: "#1B1E26"
  settings-text: "#F1F5F9"
typography:
  rooms-heading:
    fontFamily: "Manrope Variable"
    fontSize: "clamp(32px, 4vw, 46px)"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.035em"
  room-title:
    fontFamily: "Manrope Variable"
    fontSize: "16px"
    fontWeight: 750
    lineHeight: 1.4
    letterSpacing: "-0.025em"
  rooms-body:
    fontFamily: "Manrope Variable"
    fontSize: "15px"
    lineHeight: 1.65
rounded:
  action: "11px"
  input: "12px"
  room-card: "16px"
  settings-dialog: "20px"
spacing:
  compact: "8px"
  control: "12px"
  page-inline: "20px"
  grid: "24px"
components:
  room-action:
    backgroundColor: "{colors.rooms-blue}"
    textColor: "{colors.brand-surface}"
    rounded: "{rounded.action}"
    padding: "12px 22px"
  room-card:
    backgroundColor: "{colors.rooms-card}"
    textColor: "{colors.rooms-ink}"
    rounded: "{rounded.room-card}"
    padding: "10px"
---

# Design System: Focoya

## Overview

Existing visual systems coexist; no new brand identity introduced. Landing/Auth retain their global blue/slate palette. Rooms inherit the supplied `FE TEST/` prototype: pastel image-backed gallery, photographic focus scene, dark settings. This document records implementation, not a mandate to restyle unrelated routes.

Sources: `frontend/src/styles/globals.css`, `frontend/src/features/rooms/{rooms,focus-room,settings}.css`. Surface intent: `.impeccable/surfaces/frontend-src-features-rooms-roomslayout-tsx.md`.

## Colors

Global tokens remain in `:root`. Room tokens stay under `.rooms-shell`; do not hoist them globally. Explore uses ink/muted text over pastel artwork and translucent white surfaces. Blue indicates selected navigation, filters, focus and primary actions. Focus uses a dark photographic overlay with white controls. Settings uses a dark surface and light text; its scrollbar and form color scheme are dark-scoped.

## Typography

Self-hosted `@fontsource-variable/manrope`; shared `--font-manrope` fallback stack. Explore headings use the recorded heading role; at ≤640px they become 34px. Room titles are 16px. Live clock/countdown remain the dominant focus content. Timer and slot numerals use tabular figures.

## Layout

- Explore/header: centered `min(1152px, 100%)`, 20px inline padding. Gallery: three columns, 24px gap; two at ≤1000px, one at ≤640px.
- Search: 300px desktop; full width on mobile. Theme chips wrap rather than clip.
- Preview: `1.15fr 1fr`, 24px gap; one column at ≤1000px. Desktop scene minimum height 480px; stacked scene 16:9.
- Focus: minimum `100svh`; top identity/room badge, centered clock or timer, bottom tasks/tools. Mobile tools remain reachable; task panel scrolls within the viewport.
- Settings: 220px sidebar plus `minmax(0, 1fr)` content, width up to 864px, height up to `min(840px, 90dvh)`. At ≤640px, full viewport with horizontally scrollable navigation above independently scrolling content.

## Elevation & Depth

Explore uses translucent fills and light borders over the supplied background. Room-card hover moves up 4px without adding a shadow. Account menu shadow: `0 18px 40px #1e1b4b26`. Settings shadow: `0 25px 60px -12px rgba(0,0,0,0.7)`; backdrop uses `rgba(8,11,18,0.75)` and 6px blur. Focus uses a dark scene overlay for legibility.

## Shapes

Room cards: 16px; image corners: 11px; search: 12px; room actions: 11px. Filter chips use pill corners. Settings dialog: 20px desktop, square full-screen mobile. Existing Landing/Auth shapes remain unchanged.

## Components

- **Room card:** full-card link to preview; 16:10 image, theme badge, title, illustrative online count.
- **Search/filter:** URL-backed query and theme; selected buttons expose `aria-pressed`; unmatched search offers reset.
- **Primary action:** minimum 48px height, blue fill, white text; hover `#1E40AF`. Focus-visible ring: 3px blue, 4px offset.
- **Focus tools:** clock/Pomodoro switch, 25/5/15-minute modes, start/pause/reset, temporary tasks, wallpaper, tips, fullscreen. Audio remains unavailable with an honest message.
- **Settings:** native modal dialog; theme/toggles, labelled demo statistics, temporary account name, help. Unavailable audio controls are disabled.
- **Motion:** card lift and short control transitions; reduced-motion disables transitions/animations within the room shell. No new animation dependency.

## Do's and Don'ts

- Preserve `FE TEST/` artwork and composition; asset origin/rights documented in `frontend/public/room-assets/README.md`.
- Keep Landing/Auth and backend independent from room styling.
- Mark attendance/statistics as demo. Preferences and tasks are temporary client state, not synchronized user data.
- Retain keyboard labels, visible focus, 44px utility targets, scrollable modal content and useful empty/not-found states.
- Do not present realtime presence, audio, XP, persistence or server authentication as implemented by this integration.
