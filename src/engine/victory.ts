// ============================================================
// FAE ENGINE — Layer 5: Win Conditions
// Pure function: checkVictory(state) → VictoryState
// Run after every state transition.
// Keeps victory logic centralized and out of apply().
// ============================================================

import type { GameState, VictoryState, PlayerID } from "../state/types";
import { getLivingUnits, getPlayerUnits } from "../state/selectors";

// ------------------------------------------------------------
// Configuration
// ------------------------------------------------------------

export type VictoryConfig = {
    turnLimit?: number;           // game ends after this many turns
    objectiveCoords?: Array<{ x: number; y: number }>; // tiles to capture
    objectivesToWin?: number;     // how many objectives needed to win (default: all)
};

// ------------------------------------------------------------
// checkVictory
// Returns the current VictoryState based on the game state.
// Called after every apply() in the game loop.
// ------------------------------------------------------------

export function checkVictory(
    state: GameState,
    config: VictoryConfig = {}
): VictoryState {
    // Already decided — don't re-evaluate
    if (state.victoryState.status !== "ongoing") {
        return state.victoryState;
    }

    // Check in priority order
    return (
        checkElimination(state) ??
        checkCapture(state, config) ??
        checkTurnLimit(state, config) ??
        { status: "ongoing" }
    );
}

// ------------------------------------------------------------
// Elimination — last player with living units wins
// ------------------------------------------------------------

function checkElimination(state: GameState): VictoryState | null {
    const p0Alive = getPlayerUnits(state, 0).length > 0;
    const p1Alive = getPlayerUnits(state, 1).length > 0;

    if (!p0Alive && !p1Alive) return { status: "draw" };
    if (!p0Alive) return { status: "victory", winner: 1 };
    if (!p1Alive) return { status: "victory", winner: 0 };

    return null; // no winner yet
}

// ------------------------------------------------------------
// Capture — first to hold enough objective tiles wins
// ------------------------------------------------------------

function checkCapture(
    state: GameState,
    config: VictoryConfig
): VictoryState | null {
    const { objectiveCoords, objectivesToWin } = config;
    if (!objectiveCoords || objectiveCoords.length === 0) return null;

    const needed = objectivesToWin ?? objectiveCoords.length;
    const living = getLivingUnits(state);

    const count: Record<PlayerID, number> = { 0: 0, 1: 0 };

    for (const obj of objectiveCoords) {
        const occupant = living.find(
            (u) => u.coords.x === obj.x && u.coords.y === obj.y
        );
        if (occupant) {
            count[occupant.owner]++;
        }
    }

    if (count[0] >= needed && count[1] >= needed) return { status: "draw" };
    if (count[0] >= needed) return { status: "victory", winner: 0 };
    if (count[1] >= needed) return { status: "victory", winner: 1 };

    return null;
}

// ------------------------------------------------------------
// Turn limit — when turns run out, highest score wins
// Uses unit count + HP as a simple tiebreaker
// ------------------------------------------------------------

function checkTurnLimit(
    state: GameState,
    config: VictoryConfig
): VictoryState | null {
    const { turnLimit } = config;
    if (!turnLimit || state.turn <= turnLimit) return null;

    const p0Score = scorePlayer(state, 0);
    const p1Score = scorePlayer(state, 1);

    if (p0Score === p1Score) return { status: "draw" };
    return {
        status: "victory",
        winner: p0Score > p1Score ? 0 : 1,
    };
}

function scorePlayer(state: GameState, player: PlayerID): number {
    return getPlayerUnits(state, player).reduce(
        (sum, u) => sum + u.hp,
        0
    );
}

// ------------------------------------------------------------
// withVictoryCheck
// Wraps apply() calls in the game loop — checks victory after
// every transition and patches the state if the game is over.
// Usage:
//   const next = withVictoryCheck(apply(state, action), config);
// ------------------------------------------------------------

export function withVictoryCheck(
    state: GameState,
    config: VictoryConfig = {}
): GameState {
    const victory = checkVictory(state, config);
    if (victory.status === state.victoryState.status) return state;

    return {
        ...state,
        victoryState: victory,
        phase: victory.status !== "ongoing" ? "game_over" : state.phase,
    };
}