// ============================================================
// FAE ENGINE — Layer 1: State Selectors
// Pure read functions over GameState.
// No mutation. These are the query API for every other layer.
// ============================================================

import type { GameState, Unit, Tile, UnitID, PlayerID, Coords } from "./types";

// ------------------------------------------------------------
// Unit selectors
// ------------------------------------------------------------

export function getUnit(state: GameState, id: UnitID): Unit | undefined {
    return state.units[id];
}

export function getUnitAt(state: GameState, coords: Coords): Unit | undefined {
    return Object.values(state.units).find(
        (u) => u.coords.x === coords.x && u.coords.y === coords.y && u.status !== "defeated"
    );
}

export function getLivingUnits(state: GameState): Unit[] {
    return Object.values(state.units).filter((u) => u.status !== "defeated");
}

export function getPlayerUnits(state: GameState, playerId: PlayerID): Unit[] {
    return getLivingUnits(state).filter((u) => u.owner === playerId);
}

export function getActivePlayerUnits(state: GameState): Unit[] {
    return getPlayerUnits(state, state.activePlayer);
}

export function hasIdleUnits(state: GameState): boolean {
    return getActivePlayerUnits(state).some(
        (u) => u.status === "idle" || u.status === "moved"
    );
}

// ------------------------------------------------------------
// Map selectors
// ------------------------------------------------------------

export function getTile(state: GameState, coords: Coords): Tile | undefined {
    const { x, y } = coords;
    if (x < 0 || y < 0 || x >= state.map.width || y >= state.map.height) {
        return undefined;
    }
    return state.map.tiles[y]?.[x];
}

export function isInBounds(state: GameState, coords: Coords): boolean {
    return getTile(state, coords) !== undefined;
}

export function isPassable(state: GameState, coords: Coords): boolean {
    const tile = getTile(state, coords);
    if (!tile?.passable) return false;
    const occupant = getUnitAt(state, coords);
    return occupant === undefined;
}

// ------------------------------------------------------------
// Movement range selectors
// BFS flood-fill — returns all reachable coords for a unit
// ------------------------------------------------------------

export function getReachableTiles(state: GameState, unitId: UnitID): Coords[] {
    const unit = getUnit(state, unitId);
    if (!unit || unit.hasMoved || unit.status === "acted" || unit.status === "defeated") {
        return [];
    }

    const range = unit.stats.movement;
    const visited = new Map<string, number>(); // coordKey -> cost spent
    const queue: Array<{ coords: Coords; cost: number }> = [
        { coords: unit.coords, cost: 0 },
    ];
    const reachable: Coords[] = [];

    const key = (c: Coords) => `${c.x},${c.y}`;
    visited.set(key(unit.coords), 0);

    while (queue.length > 0) {
        const current = queue.shift();
        if (!current) break;
        const neighbors = getNeighbors(current.coords);

        for (const n of neighbors) {
            const tile = getTile(state, n);
            if (!tile) continue;

            // terrain movement cost
            const moveCost =
                tile.terrain === "forest" || tile.terrain === "hills" ? 2 : 1;
            const newCost = current.cost + moveCost;

            if (newCost > range) continue;

            const nKey = key(n);
            if (visited.has(nKey) && visited.get(nKey)! <= newCost) continue;

            // can't pass through enemy units, but friendly units are fine
            const occupant = getUnitAt(state, n);
            if (occupant && occupant.owner !== unit.owner) continue;
            if (!tile.passable) continue;

            visited.set(nKey, newCost);

            // can only land on empty tiles (not friendly-occupied)
            if (!occupant) {
                reachable.push(n);
            }

            queue.push({ coords: n, cost: newCost });
        }
    }

    return reachable;
}

// ------------------------------------------------------------
// Attack range selectors
// Returns all coords a unit could attack from its current position
// ------------------------------------------------------------

export function getAttackTargets(state: GameState, unitId: UnitID): Unit[] {
    const unit = getUnit(state, unitId);
    if (!unit || unit.hasActed || unit.status === "defeated") return [];

    const range = unit.stats.range;
    const enemies = getLivingUnits(state).filter((u) => u.owner !== unit.owner);

    return enemies.filter((enemy) => {
        const dist = manhattanDistance(unit.coords, enemy.coords);
        return dist <= range && dist >= 1;
    });
}

// ------------------------------------------------------------
// Utility
// ------------------------------------------------------------

export function getNeighbors(coords: Coords): Coords[] {
    const { x, y } = coords;
    return [
        { x: x, y: y - 1 }, // up
        { x: x, y: y + 1 }, // down
        { x: x - 1, y: y }, // left
        { x: x + 1, y: y }, // right
    ];
}

export function manhattanDistance(a: Coords, b: Coords): number {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function coordsEqual(a: Coords, b: Coords): boolean {
    return a.x === b.x && a.y === b.y;
}