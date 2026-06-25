// ============================================================
// FAE ENGINE — Layer 4: Minimax with Alpha-Beta Pruning
// Looks ahead `depth` turns and picks the best action.
// Because apply() is pure, speculation is free —
// no state is mutated, no events are emitted.
// ============================================================

import type { GameState, PlayerID } from "../state/types";
import type { GameAction } from "../actions/types";
import { apply } from "../actions/apply";
import { score } from "./heuristic";
import { getValidActions } from "./actions";

// ------------------------------------------------------------
// Result type
// ------------------------------------------------------------

export type MinimaxResult = {
    action: GameAction | null;  // null if no actions available
    score: number;
    depth: number;
    nodesEvaluated: number;
};

// ------------------------------------------------------------
// chooseBestAction — public API
// Call this to get the AI's chosen action for the active player.
// depth=2 is fast, depth=3 is strong, depth=4+ is slow.
// ------------------------------------------------------------

export function chooseBestAction(
    state: GameState,
    depth: number = 2
): MinimaxResult {
    const aiPlayer = state.activePlayer;
    let nodesEvaluated = 0;

    const result = minimax(
        state,
        depth,
        -Infinity,
        Infinity,
        true,
        aiPlayer,
        () => { nodesEvaluated++; }
    );

    return {
        action: result.action,
        score: result.value,
        depth,
        nodesEvaluated,
    };
}

// ------------------------------------------------------------
// minimax — recursive tree search with alpha-beta pruning
//
// maximizing = true  → it's the AI's turn (maximize score)
// maximizing = false → it's the opponent's turn (minimize score)
//
// Alpha-beta pruning skips branches that can't affect the
// result, dramatically reducing nodes evaluated.
// ------------------------------------------------------------

type MinimaxNode = {
    value: number;
    action: GameAction | null;
};

function minimax(
    state: GameState,
    depth: number,
    alpha: number,
    beta: number,
    maximizing: boolean,
    aiPlayer: PlayerID,
    onNode: () => void
): MinimaxNode {
    onNode();

    // Terminal: game over or depth exhausted
    if (depth === 0 || state.victoryState.status !== "ongoing") {
        return { value: score(state, aiPlayer), action: null };
    }

    const actions = getValidActions(state);

    // No actions available — evaluate current state
    if (actions.length === 0) {
        return { value: score(state, aiPlayer), action: null };
    }

    let bestAction: GameAction | null = actions[0] ?? null;

    if (maximizing) {
        let maxValue = -Infinity;

        for (const action of actions) {
            const next = apply(state, action);
            const child = minimax(next, depth - 1, alpha, beta, false, aiPlayer, onNode);

            if (child.value > maxValue) {
                maxValue = child.value;
                bestAction = action;
            }

            alpha = Math.max(alpha, maxValue);
            if (beta <= alpha) break; // beta cutoff — prune remaining branches
        }

        return { value: maxValue, action: bestAction };
    } else {
        let minValue = Infinity;

        for (const action of actions) {
            const next = apply(state, action);
            const child = minimax(next, depth - 1, alpha, beta, true, aiPlayer, onNode);

            if (child.value < minValue) {
                minValue = child.value;
                bestAction = action;
            }

            beta = Math.min(beta, minValue);
            if (beta <= alpha) break; // alpha cutoff — prune remaining branches
        }

        return { value: minValue, action: bestAction };
    }
}