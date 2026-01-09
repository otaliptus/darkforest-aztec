# Ticket 075 - Codebase-backed ticket status audit

## Goal
For every task in `tasks/`, read the related code/docs and determine its true status (done/in progress/pending/not started), with evidence from the repo.

## Acceptance Criteria
- Each task file is reviewed against the codebase.
- A status verdict is produced per ticket with brief evidence (file paths, functions, or docs).
- Any mismatches between ticket status blocks and code reality are called out.
- No contract/client logic changes.

## Out of Scope
- Implementing missing work.
- Updating existing ticket status blocks.

## Deliverables
- A comprehensive status report in chat.

## Tests / Commands
- None.

## Status
- Archived (2026-01-08).

