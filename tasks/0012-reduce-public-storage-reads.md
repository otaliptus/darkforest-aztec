# Ticket 0012: Reduce public storage RPC reads

## Goal
Reduce `node_getPublicStorageAt` call bursts by (1) keeping view-bundle reads enabled with an N-consecutive-failure backoff and (2) adding utility view getters for arrivals and artifacts.

## Acceptance Criteria
- View-bundle reads are not permanently disabled after a single simulate failure; fallback is per-call and only disabled after N consecutive failures.
- New utility getters exist for arrivals/artifacts and are used by the client when available.
- Hot read paths (planet refresh, arrivals, artifacts) use view getters and fall back safely to per-slot reads.
- Existing artifact behavior (spaceship fallback, ownership resolution) remains correct.
- Contract artifacts are recompiled so the client can call new utility getters.

## Notes
- N consecutive failures should be configurable in code (constant or private field), defaulting to 3 unless otherwise specified.
- No gameplay behavior changes; only read-path optimization.
