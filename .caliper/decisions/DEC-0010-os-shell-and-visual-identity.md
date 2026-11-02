---
id: DEC-0010
title: Establish the H-OS Operating System Visual Identity, Shell Chrome and Typography
status: accepted
date: 2026-11-02
tags:
  - ui
  - a11y
  - i18n
affects:
  - platform/web/**
  - packages/ui/**
  - .caliper/principles/ui-ux.md
relaxes: []
supersedes: null
---

# Context

`DEC-0004` approved the initial design tokens and shell baseline for Phase 1. However, the experience remained resembling a conventional web dashboard:
- A conventional top navigation bar instead of an operating system chrome.
- No persistent application dock or distinction between system chrome and application-local domain navigation.
- No global Command Palette (`Ctrl+K`/`Cmd+K`) for rapid application switching.
- Standard card grid launcher without clear visual distinction between production-ready workspaces and roadmap systems.
- Dependence on system-installed fallback fonts rather than self-hosted, harmonized Arabic and Latin typography.

`UX-001`, `UX-005`, `UX-006`, and `UX-014` require a cohesive operating system environment with first-class Arabic support, strict logical CSS properties, WCAG 2.2 AA contrast compliance, and no unapproved third-party dependencies.

## Options Considered

1. **Option A: Incremental CSS Restyling of Top Navbar:** Retain the top navigation bar and restyle buttons and cards.  
   *Rejected:* Fails to provide an operating system experience; feels like a standard SaaS administrative portal.

2. **Option B: Emulate a Specific Desktop OS (e.g. macOS or Windows):** Mimic floating windows, taskbars, or window management.  
   *Rejected:* Inappropriate for web-based enterprise applications; introduces immense complexity without improving enterprise workflow productivity.

3. **Option C: Establish an Original H-OS Operating Environment:**  
   - Dedicated persistent Global Dock on the inline-start edge (mirrored cleanly in RTL, collapsible to bottom dock on mobile).
   - System Bar separating system-level tools (Command Palette, Theme, Language, Profile) from application-local navigation.
   - Distinctive H-OS brand identity: Deep Obsidian Cosmos (`#0B132B`) with energetic Cyan/Teal accents, self-hosted IBM Plex Sans & IBM Plex Sans Arabic.
   - Native HTML5 `<dialog>` Command Palette for accessible keyboard-driven navigation.
   - Purposeful atmospheric Lock Screen entrance with under-200ms unlock transition.

## Decision

Adopt **Option C** and enact `platform/ui/UI_SYSTEM.md`:

1. **Supersession & Refinement of DEC-0004:**
   - **Refines DEC-0004 §2 (Color Palette):** The preliminary navy baseline is deepened and refined into HiraTechLabs' Deep Obsidian Cosmos (`#0B132B`) and Midnight Navy (`#1C2541`) with Teal (`#0D9488`) and Electric Cyan (`#00F0FF`) accents. Contrast validation is preserved and documented in `platform/ui/UI_SYSTEM.md` exceeding WCAG 2.2 AA (ratios between 4.55:1 and 18.57:1).
   - **Refines DEC-0004 §3 (Dark Mode):** Dynamic multi-theme (Light, Dark, System) and multiple color palettes (Classic, Teal, Carbon) are fully formalized and supported via CSS variables without FOUC.
   - **Refines DEC-0004 Shell Architecture:** Replaces the top navigation bar with a persistent Global Dock (inline-start) and top System Bar.

2. **Typography:**
   - Adopt **IBM Plex Sans** (Latin) and **IBM Plex Sans Arabic** (Arabic) under the SIL Open Font License (OFL).
   - Self-host WOFF2 assets directly in `@h-os/ui`.
   - Apply an additional `0.15`–`0.2` line-height multiplier for Arabic typography to accommodate ascenders, descenders, and diacritics.

3. **Application Independence:**
   - H-OS owns the shell chrome, global authorization boundaries, application discovery, and system preferences.
   - Each individual application (e.g. H-HR) retains full autonomy over its domain page composition, internal sub-routes, and information layouts.

4. **Command Palette:**
   - Implemented using native `<dialog>` and ARIA combobox/listbox conventions.
   - Accessible via `Ctrl+K` and `Cmd+K`.
   - Filters registered applications and permitted sub-routes strictly according to session permissions.

## Consequences

- The application delivers a recognizable, modern operating system feel without emulating legacy desktop windowing.
- Full RTL and LTR parity is guaranteed through CSS logical properties and typography metrics.
- All bundle constraints (200 KB JS chunk budget) remain protected; no new dependencies or animation libraries are added.
- Existing backend API contracts, security boundaries, and authorization logic remain untouched.

## Rules Affected

- `UX-001` — Shell now provides Global Dock, System Bar, and Command Palette.
- `UX-005` — Design tokens updated in `UI_SYSTEM.md` and `@h-os/ui/styles.css`.
- `UX-006` — Full Arabic/English parity and RTL/LTR logical property compliance enforced.
- `UX-007` — WCAG 2.2 AA verified for all semantic color pairs.
- `UX-012` & `UX-015` — Motion strictly bounded under 200ms with full `prefers-reduced-motion` compliance.
