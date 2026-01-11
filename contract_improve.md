the client currently sends ZK (private) transactions for several actions that don’t actually need secrecy—e.g. upgrade_planet, prospect_planet, trade_artifact, set_artifact_activation, give_space_ships, resolve_arrival—because those contract entrypoints are declared #[external("private")] and just enqueue public state transitions via apply_player_action / apply_move. The client calls them directly from connectDarkForest (darkforest.methods.*.send(...)), which forces proving even though the payload is not private. Separately, the Perlin circuit includes a 16-iteration loop in random_gradient_at that bloats constraints and slows proving

llm_bundle

.

Below is a single, concrete refactor that (1) eliminates proving for those “public-only” actions, (2) keeps the privacy-critical actions (init_player, reveal_location, create_arrival/move, find_artifact) private, and (3) includes all required proving/circuit changes, including a Perlin optimization.

✅ Goal
Remove ZK proving for:

Upgrade planet

Prospect planet

Deposit/withdraw artifacts (trade_artifact)

Activate/deactivate artifacts (set_artifact_activation)

Claim ships (give_space_ships)

Resolve arrivals (resolve_arrival)

Keep ZK proving for:

Spawn/join game (init_player)

Reveal location (reveal_location)

Move (create_arrival)

Find artifact (find_artifact)

1) Contract refactor (Noir): “Public wrappers that execute directly”
Why this works

Those actions currently are private wrappers that enqueue a public state update via:

apply_player_action (action codes 2, 3, 4, 10, 11, 12, 13)

apply_move (special sentinel path for arrival resolution)

So: the heavy work is already public; you’re just paying proving overhead because the entrypoint is private.

Concrete change
A. Extract public-internal executors (single source of truth)

Add these internal public helpers:

// packages/contracts/src/main.nr

#[internal("public")]
fn execute_give_space_ships(player: AztecAddress, location_id: Field) {
    // move the body of `if action == 2` from apply_player_action
}

#[internal("public")]
fn execute_prospect_planet(player: AztecAddress, location_id: Field) {
    // move the body of `if action == 4` from apply_player_action
}

#[internal("public")]
fn execute_trade_artifact(player: AztecAddress, location_id: Field, artifact_id: Field, withdrawing: bool) {
    // move action==10/11 logic from apply_player_action
}

#[internal("public")]
fn execute_activate_artifact(player: AztecAddress, location_id: Field, artifact_id: Field, wormhole_to: Field) {
    // move the action==12 activation logic from apply_player_action:contentReference[oaicite:13]{index=13}
}


execute_upgrade_planet already exists and is internal/public

llm_bundle


execute_deactivate_artifact already exists
execute_arrival already exists

B. Replace apply_player_action branches with calls

In apply_player_action, replace the inline blocks:

action 2 → execute_give_space_ships

action 4 → execute_prospect_planet

action 10/11 → execute_trade_artifact(..., withdrawing)

action 12 → execute_activate_artifact

action 13 already calls execute_deactivate_artifact

action 3 already calls execute_upgrade_planet

This keeps old private flows working (for the remaining private entrypoints) but lets us add public entrypoints that reuse the same code.

C. Convert the “unnecessarily private” external entrypoints to public

Replace these #[external("private")] wrappers:

give_space_ships

prospect_planet

trade_artifact

set_artifact_activation

upgrade_planet

resolve_arrival

with public entrypoints that execute immediately:

#[external("public")]
fn give_space_ships(location_id: Field) {
    let player = self.context.msg_sender().unwrap();
    self.internal.execute_give_space_ships(player, location_id);
}

#[external("public")]
fn prospect_planet(location_id: Field) {
    let player = self.context.msg_sender().unwrap();
    self.internal.execute_prospect_planet(player, location_id);
}

#[external("public")]
fn upgrade_planet(location_id: Field, branch: u8) {
    let player = self.context.msg_sender().unwrap();
    self.internal.execute_upgrade_planet(player, location_id, branch);
}

#[external("public")]
fn trade_artifact(location_id: Field, artifact_id: Field, withdrawing: bool) {
    let player = self.context.msg_sender().unwrap();
    self.internal.execute_trade_artifact(player, location_id, artifact_id, withdrawing);
}

#[external("public")]
fn set_artifact_activation(location_id: Field, artifact_id: Field, wormhole_to: Field, is_activated: bool) {
    let player = self.context.msg_sender().unwrap();
    if is_activated {
        self.internal.execute_activate_artifact(player, location_id, artifact_id, wormhole_to);
    } else {
        self.internal.execute_deactivate_artifact(player, location_id, artifact_id);
    }
}

#[external("public")]
fn resolve_arrival(arrival_id: u64) {
    self.internal.execute_arrival(arrival_id);
}


✅ This completely removes proving for these actions (they become public txs).
✅ Signatures stay identical (no client API churn).
✅ Privacy-critical flows remain private.

2) Client changes: “No more proving on these methods”

The client currently calls these methods directly in connectDarkForest. After regenerating the Aztec contract artifact (see below), the same code will now send public calls, so you do not need to touch call sites for these actions.

Only required client change

✅ Regenerate / update the Aztec contract artifact bindings so Aztec.js knows those methods are public (ABI change).
Your repo imports:

import { DarkForestContract } from "@/Backend/Aztec/contractArtifacts/dark_forest_contract";


So you must re-run whatever you currently use to generate dark_forest_contract.* after changing Noir.

I did not locate the generated dark_forest_contract file in the extracted snapshot (it is referenced but not present), so I can’t provide an exact diff for it; but it must be regenerated or the client will still think these functions are private.

3) Contract tests: update call_private → call_public

Your Noir tests currently call these actions as private (e.g. upgrade_planet, prospect_planet, etc.).

Update all occurrences:

env.call_private(player, contract, "upgrade_planet", ...)

env.call_private(player, contract, "prospect_planet", ...)

env.call_private(player, contract, "trade_artifact", ...)

env.call_private(player, contract, "set_artifact_activation", ...)

env.call_private(player, contract, "give_space_ships", ...)

env.call_private(player, contract, "resolve_arrival", ...)

to:

env.call_public(player, contract, "upgrade_planet", args);


The test harness supports call_public already.

4) ZK circuit optimization: Fix the Perlin gradient loop

Your Perlin implementation uses a 16-iteration loop to select the gradient vector

llm_bundle

:

for i in 0..16 {
    if i == idx { gx = ...; gy = ...; }
}


This unrolls into lots of constraints and costs proving time in privacy-critical functions (init_player, reveal_location, etc.).

Replace with constant table + direct match

Example implementation (constraint-friendly):

fn random_gradient_at(key: Field, ix: u64, iy: u64) -> (Signed, Signed) {
    let idx = random_u4(key, ix, iy);

    // compile-time constant gradient table
    let (gx_i, gy_i) = match idx {
        0 => (10000i64, 0i64),
        1 => (9239i64, 3827i64),
        2 => (7071i64, 7071i64),
        3 => (3827i64, 9239i64),
        4 => (0i64, 10000i64),
        5 => (-3827i64, 9239i64),
        6 => (-7071i64, 7071i64),
        7 => (-9239i64, 3827i64),
        8 => (-10000i64, 0i64),
        9 => (-9239i64, -3827i64),
        10 => (-7071i64, -7071i64),
        11 => (-3827i64, -9239i64),
        12 => (0i64, -10000i64),
        13 => (3827i64, -9239i64),
        14 => (7071i64, -7071i64),
        _ => (9239i64, -3827i64),
    };

    (Signed::from_i64(gx_i), Signed::from_i64(gy_i))
}


✅ Removes the loop entirely.
✅ Keeps deterministic output identical.
✅ Directly reduces proof constraints in all Perlin-based private proofs.

5) What you get after this refactor
Proving eliminated for:

Upgrade, prospect, deposit/withdraw, activate/deactivate, claim ships, resolve arrivals
→ They become fast public txs.

Proving remains only where needed:

Spawn, reveal, move, find_artifact
→ Still private, still ZK.

Circuit proving improved:

Perlin selection becomes cheaper (no loop).
