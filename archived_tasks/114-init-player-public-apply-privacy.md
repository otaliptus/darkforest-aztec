# Ticket 114 - Init player public apply privacy

## Goal
Remove spawn coordinates from the public apply calldata/state for init while keeping reveal_location as the only flow that publicly exposes coordinates.

## Acceptance Criteria
- Public apply flow for init does not include `x,y` in calldata or public storage writes.
- `reveal_location` still uses a public apply that accepts `x,y` and writes `RevealedCoords`.
- `apply_player_action` remains for other actions without exposing `x,y`.
- Update docs that describe the public apply flow (at least `docs/action-call-graphs.md`, and `mermaid_diagrams.md` if needed).
- Relevant Noir contract tests pass.
- No changes under `reference/`.

## Notes
- Do not alter spawn rules or add sentinel coordinates.
- Keep the private-validate -> public-apply pattern with `only_self` for state transitions.
