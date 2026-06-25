// ============================================================
// FAE ENGINE — Layer 4: AI Action Generator
// getValidActions(state) → GameAction[]
// Returns every legal action for the active player.
// The minimax tree is built by calling this at each node.
// ============================================================

import type { GameState } from "../state/types";
import type { GameAction } from "../actions/types";
import { moveAction, attackAction, waitAction, endTurnAction } from "../actions/types";
import { validate } from "../actions/validate";
import {
    getActivePlayerUnits,
    getReachableTiles,
    getAttackTargets,
} from "../state/selectors";

// ------------------------------------------------------------
// getValidActions
// Enumerates every legal action from the current state.
// Order: attacks first (aggressive), then moves, then waits,
// then end turn — biases the tree toward action early.
// ------------------------------------------------------------

export function getValidActions(state: GameState): GameAction[] {
    if (state.victoryState.status !== "ongoing") return [];

    const actions: GameAction[] = [];
    const units = getActivePlayerUnits(state);

    for (const unit of units) {
        // Attacks
        const targets = getAttackTargets(state, unit.id);
        for (const target of targets) {
            const action = attackAction(unit.id, target.id);
            if (validate(state, action).valid) {
                actions.push(action);
            }
        }

        // Moves
        if (!unit.hasMoved) {
            const reachable = getReachableTiles(state, unit.id);
            for (const dest of reachable) {
                const action = moveAction(unit.id, unit.coords, dest);
                if (validate(state, action).valid) {
                    actions.push(action);
                }
            }
        }

        // Wait — mark this unit done without acting
        const wait = waitAction(unit.id);
        if (validate(state, wait).valid) {
            actions.push(wait);
        }
    }

    // End turn — always available during player phase
    const end = endTurnAction(state.activePlayer);
    if (validate(state, end).valid) {
        actions.push(end);
    }

    return actions;
}