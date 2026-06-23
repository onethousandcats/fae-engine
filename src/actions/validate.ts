// ============================================================
// FAE ENGINE — Layer 3: Rules / Validation
// Pure function: validate(state, action) → ValidationResult
// Nothing mutates here. Just checks.
// ============================================================

import type { GameState } from "../state/types";
import type { GameAction, MoveAction, AttackAction, WaitAction, EndTurnAction } from "./types";
import {
    getUnit,
    getReachableTiles,
    getAttackTargets,
    coordsEqual,
} from "../state/selectors";

// ------------------------------------------------------------
// Result type — carry the reason on failure, useful for UI/AI
// ------------------------------------------------------------

export type ValidationResult =
    | { valid: true }
    | { valid: false; reason: string };

export const OK: ValidationResult = { valid: true };

function fail(reason: string): ValidationResult {
    return { valid: false, reason };
}

// ------------------------------------------------------------
// Top-level dispatcher
// ------------------------------------------------------------

export function validate(state: GameState, action: GameAction): ValidationResult {
    if (state.victoryState.status !== "ongoing") {
        return fail("Game is already over.");
    }

    switch (action.type) {
        case "MOVE": return validateMove(state, action);
        case "ATTACK": return validateAttack(state, action);
        case "WAIT": return validateWait(state, action);
        case "END_TURN": return validateEndTurn(state, action);
    }
}

// ------------------------------------------------------------
// MOVE
// ------------------------------------------------------------

function validateMove(state: GameState, action: MoveAction): ValidationResult {
    const unit = getUnit(state, action.unitId);

    if (!unit)
        return fail(`Unit ${action.unitId} does not exist.`);

    if (unit.owner !== state.activePlayer)
        return fail("You can only move your own units.");

    if (state.phase !== "player_phase" && state.phase !== "unit_phase")
        return fail("Cannot move outside of the player phase.");

    if (unit.hasMoved)
        return fail("This unit has already moved this turn.");

    if (unit.status === "acted" || unit.status === "defeated" || unit.status === "stunned")
        return fail(`Unit is ${unit.status} and cannot move.`);

    if (!coordsEqual(unit.coords, action.from))
        return fail("Unit is not at the specified starting position.");

    if (coordsEqual(action.from, action.to))
        return fail("Move destination is the same as current position.");

    const reachable = getReachableTiles(state, action.unitId);
    const canReach = reachable.some((c) => coordsEqual(c, action.to));

    if (!canReach)
        return fail("Destination is not reachable with this unit's movement range.");

    return OK;
}

// ------------------------------------------------------------
// ATTACK
// ------------------------------------------------------------

function validateAttack(state: GameState, action: AttackAction): ValidationResult {
    const attacker = getUnit(state, action.attackerId);
    const target = getUnit(state, action.targetId);

    if (!attacker)
        return fail(`Attacker ${action.attackerId} does not exist.`);

    if (!target)
        return fail(`Target ${action.targetId} does not exist.`);

    if (attacker.owner !== state.activePlayer)
        return fail("You can only attack with your own units.");

    if (state.phase !== "player_phase" && state.phase !== "unit_phase")
        return fail("Cannot attack outside of the player phase.");

    if (attacker.hasActed)
        return fail("This unit has already acted this turn.");

    if (attacker.status === "acted" || attacker.status === "defeated" || attacker.status === "stunned")
        return fail(`Attacker is ${attacker.status} and cannot act.`);

    if (target.status === "defeated")
        return fail("Cannot attack a defeated unit.");

    if (target.owner === attacker.owner)
        return fail("Cannot attack your own unit.");

    const targets = getAttackTargets(state, action.attackerId);
    const inRange = targets.some((u) => u.id === action.targetId);

    if (!inRange)
        return fail("Target is out of attack range.");

    return OK;
}

// ------------------------------------------------------------
// WAIT
// ------------------------------------------------------------

function validateWait(state: GameState, action: WaitAction): ValidationResult {
    const unit = getUnit(state, action.unitId);

    if (!unit)
        return fail(`Unit ${action.unitId} does not exist.`);

    if (unit.owner !== state.activePlayer)
        return fail("You can only issue wait to your own units.");

    if (state.phase !== "player_phase" && state.phase !== "unit_phase")
        return fail("Cannot wait outside of the player phase.");

    if (unit.status === "acted" || unit.status === "defeated")
        return fail(`Unit is already ${unit.status}.`);

    return OK;
}

// ------------------------------------------------------------
// END TURN
// ------------------------------------------------------------

function validateEndTurn(state: GameState, action: EndTurnAction): ValidationResult {
    if (action.playerId !== state.activePlayer)
        return fail("Only the active player can end the turn.");

    if (state.phase !== "player_phase" && state.phase !== "unit_phase")
        return fail("Cannot end turn in this phase.");

    return OK;
}