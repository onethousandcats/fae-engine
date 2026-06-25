// ============================================================
// FAE ENGINE — Layer 4: AI Heuristic
// score(state, player) → float
// Higher = better for that player.
// Four weighted factors: damage dealt, unit safety,
// proximity to enemies, and objective control.
// ============================================================

import type { GameState, Unit, PlayerID } from "../state/types";
import { getLivingUnits, getPlayerUnits, manhattanDistance } from "../state/selectors";

// ------------------------------------------------------------
// Weights — tune these to change AI personality
// ------------------------------------------------------------

const WEIGHTS = {
    HP_ADVANTAGE: 2.0,  // per HP difference between sides
    UNIT_COUNT: 10.0,  // per living unit advantage
    PROXIMITY: -1.5,  // per average distance to nearest enemy (negative = closer is better)
    OBJECTIVE: 15.0,  // per objective tile controlled
};

// ------------------------------------------------------------
// score
// Returns a float from the perspective of `player`.
// Positive = good for player. Negative = bad.
// Called by minimax on every leaf node.
// ------------------------------------------------------------

export function score(state: GameState, player: PlayerID): number {
    if (state.victoryState.status === "victory") {
        return state.victoryState.winner === player ? Infinity : -Infinity;
    }
    if (state.victoryState.status === "draw") {
        return 0;
    }

    const opponent: PlayerID = player === 0 ? 1 : 0;

    const myUnits = getPlayerUnits(state, player);
    const enemyUnits = getPlayerUnits(state, opponent);
    const allLiving = getLivingUnits(state);

    // ----------------------------------------------------------
    // Factor 1: HP advantage
    // Sum of my HP minus sum of enemy HP
    // ----------------------------------------------------------
    const myHp = myUnits.reduce((sum, u) => sum + u.hp, 0);
    const enemyHp = enemyUnits.reduce((sum, u) => sum + u.hp, 0);
    const hpScore = (myHp - enemyHp) * WEIGHTS.HP_ADVANTAGE;

    // ----------------------------------------------------------
    // Factor 2: Unit count advantage
    // Each living unit I have over the enemy is worth a lot
    // ----------------------------------------------------------
    const unitScore = (myUnits.length - enemyUnits.length) * WEIGHTS.UNIT_COUNT;

    // ----------------------------------------------------------
    // Factor 3: Proximity to enemies
    // Average distance from each of my units to their nearest enemy.
    // Closer = better (we want to engage).
    // ----------------------------------------------------------
    const proximityScore = myUnits.length === 0 || enemyUnits.length === 0
        ? 0
        : myUnits.reduce((sum, mine) => {
            const nearest = Math.min(
                ...enemyUnits.map((e) => manhattanDistance(mine.coords, e.coords))
            );
            return sum + nearest;
        }, 0) / myUnits.length * WEIGHTS.PROXIMITY;

    // ----------------------------------------------------------
    // Factor 4: Objective control
    // Count objective tiles held by each side.
    // An objective tile is occupied by a unit of that player.
    // Currently uses map corners as placeholder objectives —
    // replace with explicit objective coords when map supports it.
    // ----------------------------------------------------------
    const objectiveCoords = getObjectiveTiles(state);
    const objectiveScore = objectiveCoords.reduce((sum, obj) => {
        const occupant = allLiving.find(
            (u) => u.coords.x === obj.x && u.coords.y === obj.y
        );
        if (!occupant) return sum;
        return sum + (occupant.owner === player ? WEIGHTS.OBJECTIVE : -WEIGHTS.OBJECTIVE);
    }, 0);

    return hpScore + unitScore + proximityScore + objectiveScore;
}

// ------------------------------------------------------------
// Placeholder objective tile locations
// Returns map corners until the map supports explicit objectives
// ------------------------------------------------------------

function getObjectiveTiles(state: GameState): Array<{ x: number; y: number }> {
    const { width, height } = state.map;
    return [
        { x: 0, y: 0 },
        { x: width - 1, y: 0 },
        { x: 0, y: height - 1 },
        { x: width - 1, y: height - 1 },
    ];
}

// ------------------------------------------------------------
// Export weights for tuning/testing
// ------------------------------------------------------------

export { WEIGHTS };