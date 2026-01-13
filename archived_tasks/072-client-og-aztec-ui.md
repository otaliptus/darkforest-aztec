# Ticket 072 - Client-OG UI integration (Aztec-safe, no lobbies/events)

## Goal
Use `apps/client-og` UI as the base for the Aztec client, with a single enter-and-play flow and all Ethereum-only UX removed or made safe.

## Acceptance Criteria
- `apps/client` renders the OG v0.6 UI look/feel using `apps/client-og` Frontend sources.
- Only a simple play entry page remains (no lobbies/events routes).
- OG UI elements that assume Ethereum/xDAI/whitelist/twitter are removed or display Aztec-safe messaging.
- Known OG features not implemented on Aztec are explicitly listed for follow-up.
- `yarn client:build` succeeds.

## Planned Files
- apps/client/src/Frontend/Components/**
- apps/client/src/Frontend/Game/**
- apps/client/src/Frontend/Panes/**
- apps/client/src/Frontend/Renderers/**
- apps/client/src/Frontend/Styles/**
- apps/client/src/Frontend/Utils/** (keep AppHooks)
- apps/client/src/Frontend/Views/**
- apps/client/src/Frontend/Pages/App.tsx
- apps/client/src/Frontend/Pages/GameLandingPage.tsx

## Status
- Archived (2026-01-08).

## Tests
- `yarn client:build` (warnings from aztec bb.js sourcemaps + asset size)
