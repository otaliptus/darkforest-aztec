# Dark Forest on Aztec — Agent Instructions

You are working in a grant repo. Do NOT improvise scope.

## First things first

Read the grant proposal under grant_proposal.md. Then understand the structure of this repository - I've basically tried to make things easier for you by cloning a runnable Dark Forest repo and Noir itself. For both there should be docs if you need to understand more.

## Non-negotiables (from RFPG)
- Faithful Dark Forest v0.6 port.
- Circom logic must be implemented as Noir/Aztec contract logic (private validators).
- Web client must be playable.
- Artifacts through spacetime rips mint Aztec-native NFTs.
- Performance target: a single turn < 60 seconds end-to-end.

## Repo map
- packages/contracts: Aztec.nr contracts + scripts (compile/codegen/deploy/test).
- apps/client: Web client (React).
- packages/shared: TS types/constants shared between client/scripts.

## Operating rules (VERY IMPORTANT)
1) Work ONE ticket at a time from /tasks. If no ticket exists, create one first.
2) Before editing code:
   - Restate the ticket acceptance criteria.
   - List files you plan to touch.
3) After changes:
   - Run the relevant tests/commands.
   - Summarize what changed + why.
4) Never add unbounded loops in public contract functions.
5) Contract pattern must be: private validate -> public apply (only_self) for state transitions.
6) Keep changes mid sized. Prefer incremental commits.


