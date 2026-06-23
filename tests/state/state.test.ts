import { describe, it, expect } from "vitest";
import {
    createFlatMap,
    createMapFromString,
    createTile,
    createUnit,
    createGameState,
    BASE_STATS,
} from "../../src/state/factory";
import {
    getUnit,
    getUnitAt,
    getLivingUnits,
    getPlayerUnits,
    getActivePlayerUnits,
    hasIdleUnits,
    getTile,
    isInBounds,
    isPassable,
    getReachableTiles,
    getAttackTargets,
    getNeighbors,
    manhattanDistance,
    coordsEqual,
} from "../../src/state/selectors";

// ------------------------------------------------------------
// Shared fixtures
// ------------------------------------------------------------

function makeGame() {
    return createGameState({
        map: createFlatMap(8, 8),
        player0Units: [
            { class: "infantry", coords: { x: 0, y: 0 } },
            { class: "archer", coords: { x: 1, y: 0 } },
        ],
        player1Units: [
            { class: "cavalry", coords: { x: 7, y: 7 } },
        ],
    });
}

// ------------------------------------------------------------
// createFlatMap
// ------------------------------------------------------------

describe("createFlatMap", () => {
    it("produces the correct dimensions", () => {
        const map = createFlatMap(8, 6);
        expect(map.width).toBe(8);
        expect(map.height).toBe(6);
    });

    it("fills every tile with plains terrain", () => {
        const map = createFlatMap(4, 4);
        for (let y = 0; y < 4; y++) {
            for (let x = 0; x < 4; x++) {
                expect(map.tiles[y]?.[x]?.terrain).toBe("plains");
            }
        }
    });

    it("sets all tiles as passable", () => {
        const map = createFlatMap(4, 4);
        for (let y = 0; y < 4; y++) {
            for (let x = 0; x < 4; x++) {
                expect(map.tiles[y]?.[x]?.passable).toBe(true);
            }
        }
    });

    it("tiles have correct coords", () => {
        const map = createFlatMap(3, 3);
        expect(map.tiles[2]?.[1]?.coords).toEqual({ x: 1, y: 2 });
    });
});

// ------------------------------------------------------------
// createMapFromString
// ------------------------------------------------------------

describe("createMapFromString", () => {
    it("parses terrain characters correctly", () => {
        const map = createMapFromString(`
      . F H
      W X .
    `);
        expect(map.tiles[0]?.[0]?.terrain).toBe("plains");
        expect(map.tiles[0]?.[1]?.terrain).toBe("forest");
        expect(map.tiles[0]?.[2]?.terrain).toBe("hills");
        expect(map.tiles[1]?.[0]?.terrain).toBe("water");
        expect(map.tiles[1]?.[1]?.terrain).toBe("wall");
        expect(map.tiles[1]?.[2]?.terrain).toBe("plains");
    });

    it("correctly marks impassable terrain", () => {
        const map = createMapFromString(`
      . W X
    `);
        expect(map.tiles[0]?.[0]?.passable).toBe(true);
        expect(map.tiles[0]?.[1]?.passable).toBe(false);
        expect(map.tiles[0]?.[2]?.passable).toBe(false);
    });

    it("correctly marks LOS-blocking terrain", () => {
        const map = createMapFromString(`
      . F H X
    `);
        expect(map.tiles[0]?.[0]?.blocksLOS).toBe(false);
        expect(map.tiles[0]?.[1]?.blocksLOS).toBe(false);
        expect(map.tiles[0]?.[2]?.blocksLOS).toBe(true);
        expect(map.tiles[0]?.[3]?.blocksLOS).toBe(true);
    });

    it("infers correct dimensions", () => {
        const map = createMapFromString(`
      . . . . .
      . . . . .
      . . . . .
    `);
        expect(map.width).toBe(5);
        expect(map.height).toBe(3);
    });

    it("falls back to plains for unknown characters", () => {
        const map = createMapFromString(`. ? .`);
        expect(map.tiles[0]?.[1]?.terrain).toBe("plains");
    });
});

// ------------------------------------------------------------
// createTile
// ------------------------------------------------------------

describe("createTile", () => {
    it("creates a plains tile correctly", () => {
        const tile = createTile({ x: 2, y: 3 }, "plains");
        expect(tile.terrain).toBe("plains");
        expect(tile.passable).toBe(true);
        expect(tile.blocksLOS).toBe(false);
        expect(tile.coords).toEqual({ x: 2, y: 3 });
    });

    it("creates a wall tile as impassable and LOS-blocking", () => {
        const tile = createTile({ x: 0, y: 0 }, "wall");
        expect(tile.passable).toBe(false);
        expect(tile.blocksLOS).toBe(true);
    });

    it("creates a forest tile as passable but not LOS-blocking", () => {
        const tile = createTile({ x: 0, y: 0 }, "forest");
        expect(tile.passable).toBe(true);
        expect(tile.blocksLOS).toBe(false);
    });

    it("creates a hills tile as passable and LOS-blocking", () => {
        const tile = createTile({ x: 0, y: 0 }, "hills");
        expect(tile.passable).toBe(true);
        expect(tile.blocksLOS).toBe(true);
    });

    it("creates a water tile as impassable", () => {
        const tile = createTile({ x: 0, y: 0 }, "water");
        expect(tile.passable).toBe(false);
    });
});

// ------------------------------------------------------------
// createUnit
// ------------------------------------------------------------

describe("createUnit", () => {
    it("initializes unit with full hp from base stats", () => {
        const unit = createUnit(0, "infantry", { x: 0, y: 0 });
        expect(unit.hp).toBe(BASE_STATS.infantry.maxHp);
    });

    it("sets status to idle", () => {
        const unit = createUnit(0, "cavalry", { x: 0, y: 0 });
        expect(unit.status).toBe("idle");
        expect(unit.hasMoved).toBe(false);
        expect(unit.hasActed).toBe(false);
    });

    it("assigns correct owner", () => {
        const unit = createUnit(1, "mage", { x: 3, y: 4 });
        expect(unit.owner).toBe(1);
        expect(unit.coords).toEqual({ x: 3, y: 4 });
    });

    it("respects id override", () => {
        const unit = createUnit(0, "archer", { x: 0, y: 0 }, "my_unit");
        expect(unit.id).toBe("my_unit");
    });

    it("applies correct stats per class", () => {
        const mage = createUnit(0, "mage", { x: 0, y: 0 });
        expect(mage.stats).toEqual(BASE_STATS.mage);
        expect(mage.stats.attack).toBe(5);
        expect(mage.stats.movement).toBe(2);
    });
});

// ------------------------------------------------------------
// createGameState
// ------------------------------------------------------------

describe("createGameState", () => {
    it("initializes with correct turn and active player", () => {
        const state = makeGame();
        expect(state.turn).toBe(1);
        expect(state.activePlayer).toBe(0);
        expect(state.phase).toBe("player_phase");
    });

    it("starts with ongoing victory state", () => {
        const state = makeGame();
        expect(state.victoryState.status).toBe("ongoing");
    });

    it("registers all units in the units record", () => {
        const state = makeGame();
        const unitCount = Object.keys(state.units).length;
        expect(unitCount).toBe(3); // 2 p0 + 1 p1
    });

    it("assigns units to correct players", () => {
        const state = makeGame();
        const p0Units = Object.values(state.units).filter((u) => u.owner === 0);
        const p1Units = Object.values(state.units).filter((u) => u.owner === 1);
        expect(p0Units).toHaveLength(2);
        expect(p1Units).toHaveLength(1);
    });

    it("starts with empty history", () => {
        const state = makeGame();
        expect(state.history).toHaveLength(0);
    });

    it("player unit ID lists match the units record", () => {
        const state = makeGame();
        for (const id of state.players[0].unitIds) {
            expect(state.units[id]).toBeDefined();
            expect(state.units[id]?.owner).toBe(0);
        }
    });
});

// ------------------------------------------------------------
// getTile
// ------------------------------------------------------------

describe("getTile", () => {
    it("returns the correct tile for valid coords", () => {
        const state = makeGame();
        const tile = getTile(state, { x: 0, y: 0 });
        expect(tile).toBeDefined();
        expect(tile?.terrain).toBe("plains");
        expect(tile?.coords).toEqual({ x: 0, y: 0 });
    });

    it("returns undefined for negative coords", () => {
        const state = makeGame();
        expect(getTile(state, { x: -1, y: 0 })).toBeUndefined();
        expect(getTile(state, { x: 0, y: -1 })).toBeUndefined();
    });

    it("returns undefined for out-of-bounds coords", () => {
        const state = makeGame();
        expect(getTile(state, { x: 8, y: 0 })).toBeUndefined();
        expect(getTile(state, { x: 0, y: 8 })).toBeUndefined();
    });

    it("returns the correct terrain for a mixed map", () => {
        const state = createGameState({
            map: createMapFromString(`
        . F
        H W
      `),
            player0Units: [{ class: "infantry", coords: { x: 0, y: 0 } }],
            player1Units: [{ class: "infantry", coords: { x: 1, y: 0 } }],
        });
        expect(getTile(state, { x: 1, y: 0 })?.terrain).toBe("forest");
        expect(getTile(state, { x: 0, y: 1 })?.terrain).toBe("hills");
        expect(getTile(state, { x: 1, y: 1 })?.terrain).toBe("water");
    });
});

// ------------------------------------------------------------
// isInBounds
// ------------------------------------------------------------

describe("isInBounds", () => {
    it("returns true for valid coords", () => {
        const state = makeGame();
        expect(isInBounds(state, { x: 0, y: 0 })).toBe(true);
        expect(isInBounds(state, { x: 7, y: 7 })).toBe(true);
    });

    it("returns false for out-of-bounds coords", () => {
        const state = makeGame();
        expect(isInBounds(state, { x: 8, y: 0 })).toBe(false);
        expect(isInBounds(state, { x: 0, y: -1 })).toBe(false);
    });
});

// ------------------------------------------------------------
// isPassable
// ------------------------------------------------------------

describe("isPassable", () => {
    it("returns true for empty plains", () => {
        const state = makeGame();
        expect(isPassable(state, { x: 3, y: 3 })).toBe(true);
    });

    it("returns false for out-of-bounds", () => {
        const state = makeGame();
        expect(isPassable(state, { x: -1, y: 0 })).toBe(false);
    });

    it("returns false for impassable terrain", () => {
        const state = createGameState({
            map: createMapFromString(`. W\n. .`),
            player0Units: [{ class: "infantry", coords: { x: 0, y: 0 } }],
            player1Units: [{ class: "infantry", coords: { x: 0, y: 1 } }],
        });
        expect(isPassable(state, { x: 1, y: 0 })).toBe(false);
    });

    it("returns false for a tile occupied by any unit", () => {
        const state = makeGame();
        // p0 infantry is at (0,0)
        expect(isPassable(state, { x: 0, y: 0 })).toBe(false);
    });
});

// ------------------------------------------------------------
// getUnit / getUnitAt
// ------------------------------------------------------------

describe("getUnit", () => {
    it("returns the unit for a valid id", () => {
        const state = makeGame();
        const [id] = Object.keys(state.units);
        expect(getUnit(state, id!)).toBeDefined();
    });

    it("returns undefined for an unknown id", () => {
        const state = makeGame();
        expect(getUnit(state, "ghost_unit")).toBeUndefined();
    });
});

describe("getUnitAt", () => {
    it("returns the unit at occupied coords", () => {
        const state = makeGame();
        const unit = getUnitAt(state, { x: 0, y: 0 });
        expect(unit).toBeDefined();
        expect(unit?.owner).toBe(0);
    });

    it("returns undefined for empty coords", () => {
        const state = makeGame();
        expect(getUnitAt(state, { x: 4, y: 4 })).toBeUndefined();
    });

    it("does not return defeated units", () => {
        const state = makeGame();
        const [id] = Object.keys(state.units);
        const withDefeated = {
            ...state,
            units: { ...state.units, [id!]: { ...state.units[id!]!, status: "defeated" as const } },
        };
        const unit = getUnitAt(withDefeated, { x: 0, y: 0 });
        expect(unit?.status).not.toBe("defeated");
    });
});

// ------------------------------------------------------------
// getLivingUnits / getPlayerUnits / getActivePlayerUnits
// ------------------------------------------------------------

describe("getLivingUnits", () => {
    it("returns all non-dead units", () => {
        const state = makeGame();
        expect(getLivingUnits(state)).toHaveLength(3);
    });

    it("excludes defeated units", () => {
        const state = makeGame();
        const [id] = Object.keys(state.units);
        const withDefeated = {
            ...state,
            units: { ...state.units, [id!]: { ...state.units[id!]!, status: "defeated" as const } },
        };
        expect(getLivingUnits(withDefeated)).toHaveLength(2);
    });
});

describe("getPlayerUnits", () => {
    it("returns only the specified player's living units", () => {
        const state = makeGame();
        expect(getPlayerUnits(state, 0)).toHaveLength(2);
        expect(getPlayerUnits(state, 1)).toHaveLength(1);
    });
});

describe("getActivePlayerUnits", () => {
    it("returns units for the active player", () => {
        const state = makeGame();
        expect(getActivePlayerUnits(state)).toHaveLength(2);
        expect(getActivePlayerUnits(state).every((u) => u.owner === 0)).toBe(true);
    });
});

describe("hasIdleUnits", () => {
    it("returns true when active player has idle units", () => {
        const state = makeGame();
        expect(hasIdleUnits(state)).toBe(true);
    });

    it("returns false when all active player units are done", () => {
        const state = makeGame();
        const doneUnits = Object.fromEntries(
            Object.entries(state.units).map(([id, u]) =>
                u.owner === 0 ? [id, { ...u, status: "done" as const }] : [id, u]
            )
        );
        const allDone = { ...state, units: doneUnits };
        expect(hasIdleUnits(allDone)).toBe(false);
    });
});

// ------------------------------------------------------------
// getReachableTiles
// ------------------------------------------------------------

describe("getReachableTiles", () => {
    it("returns reachable tiles within move range on flat map", () => {
        const state = createGameState({
            map: createFlatMap(10, 10),
            player0Units: [{ class: "infantry", coords: { x: 5, y: 5 } }],
            player1Units: [{ class: "infantry", coords: { x: 9, y: 9 } }],
        });
        const [id] = Object.keys(state.units).filter((k) => state.units[k]?.owner === 0);
        const reachable = getReachableTiles(state, id!);

        // Infantry has moveRange 4 — manhattan distance ≤ 4 from (5,5), excluding occupied
        expect(reachable.length).toBeGreaterThan(0);
        for (const coords of reachable) {
            expect(manhattanDistance({ x: 5, y: 5 }, coords)).toBeLessThanOrEqual(4);
        }
    });

    it("does not include the unit's current tile", () => {
        const state = makeGame();
        const [id] = Object.keys(state.units).filter((k) => state.units[k]?.owner === 0);
        const reachable = getReachableTiles(state, id!);
        const atStart = reachable.some((c) => coordsEqual(c, { x: 0, y: 0 }));
        expect(atStart).toBe(false);
    });

    it("does not include tiles occupied by enemies", () => {
        const state = createGameState({
            map: createFlatMap(5, 5),
            player0Units: [{ class: "cavalry", coords: { x: 0, y: 0 } }],
            player1Units: [{ class: "infantry", coords: { x: 2, y: 0 } }],
        });
        const [id] = Object.keys(state.units).filter((k) => state.units[k]?.owner === 0);
        const reachable = getReachableTiles(state, id!);
        const includesEnemy = reachable.some((c) => coordsEqual(c, { x: 2, y: 0 }));
        expect(includesEnemy).toBe(false);
    });

    it("returns empty array for a unit that has already moved", () => {
        const state = makeGame();
        const [id] = Object.keys(state.units).filter((k) => state.units[k]?.owner === 0);
        const movedState = {
            ...state,
            units: { ...state.units, [id!]: { ...state.units[id!]!, hasMoved: true } },
        };
        expect(getReachableTiles(movedState, id!)).toHaveLength(0);
    });

    it("returns empty array for a defeated unit", () => {
        const state = makeGame();
        const [id] = Object.keys(state.units).filter((k) => state.units[k]?.owner === 0);
        const defeatedState = {
            ...state,
            units: { ...state.units, [id!]: { ...state.units[id!]!, status: "defeated" as const } },
        };
        expect(getReachableTiles(defeatedState, id!)).toHaveLength(0);
    });

    it("respects extra movement cost for forest and hills tiles", () => {
        const state = createGameState({
            map: createMapFromString(`
        . F F F F .
        . . . . . .
      `),
            player0Units: [{ class: "infantry", coords: { x: 0, y: 0 } }],
            player1Units: [{ class: "infantry", coords: { x: 5, y: 1 } }],
        });
        const [id] = Object.keys(state.units).filter((k) => state.units[k]?.owner === 0);
        const reachable = getReachableTiles(state, id!);

        // Infantry moveRange=4. Going through forest costs 2 per tile.
        // (1,0) costs 2, (2,0) costs 4 — reachable. (3,0) costs 6 — not reachable.
        expect(reachable.some((c) => coordsEqual(c, { x: 1, y: 0 }))).toBe(true);
        expect(reachable.some((c) => coordsEqual(c, { x: 2, y: 0 }))).toBe(true);
        expect(reachable.some((c) => coordsEqual(c, { x: 3, y: 0 }))).toBe(false);
    });

    it("cannot reach through impassable water tiles", () => {
        const state = createGameState({
            map: createMapFromString(`
        . W .
        . . .
      `),
            player0Units: [{ class: "infantry", coords: { x: 0, y: 0 } }],
            player1Units: [{ class: "infantry", coords: { x: 2, y: 1 } }],
        });
        const [id] = Object.keys(state.units).filter((k) => state.units[k]?.owner === 0);
        const reachable = getReachableTiles(state, id!);

        // (2,0) is blocked by water at (1,0) — can only reach via (1,1) then (2,1)
        // but (2,1) is occupied by p1. (2,0) costs 3 via bottom path — within range.
        expect(reachable.some((c) => coordsEqual(c, { x: 1, y: 0 }))).toBe(false);
    });
});

// ------------------------------------------------------------
// getAttackTargets
// ------------------------------------------------------------

describe("getAttackTargets", () => {
    it("returns enemies within attack range", () => {
        const state = createGameState({
            map: createFlatMap(8, 8),
            player0Units: [{ class: "infantry", coords: { x: 0, y: 0 } }],
            player1Units: [{ class: "infantry", coords: { x: 1, y: 0 } }],
        });
        const [id] = Object.keys(state.units).filter((k) => state.units[k]?.owner === 0);
        const targets = getAttackTargets(state, id!);
        expect(targets).toHaveLength(1);
        expect(targets[0]?.owner).toBe(1);
    });

    it("excludes enemies out of range", () => {
        const state = makeGame(); // p0 at (0,0), p1 at (7,7) — far out of melee range
        const [id] = Object.keys(state.units).filter((k) => state.units[k]?.owner === 0);
        const targets = getAttackTargets(state, id!);
        expect(targets).toHaveLength(0);
    });

    it("archer can hit targets up to range 3", () => {
        const state = createGameState({
            map: createFlatMap(8, 8),
            player0Units: [{ class: "archer", coords: { x: 0, y: 0 } }],
            player1Units: [{ class: "infantry", coords: { x: 3, y: 0 } }],
        });
        const [id] = Object.keys(state.units).filter((k) => state.units[k]?.owner === 0);
        const targets = getAttackTargets(state, id!);
        expect(targets).toHaveLength(1);
    });

    it("returns empty for a unit that has already acted", () => {
        const state = makeGame();
        const [id] = Object.keys(state.units).filter((k) => state.units[k]?.owner === 0);
        const actedState = {
            ...state,
            units: { ...state.units, [id!]: { ...state.units[id!]!, hasActed: true } },
        };
        expect(getAttackTargets(actedState, id!)).toHaveLength(0);
    });

    it("does not return friendly units as targets", () => {
        const state = makeGame(); // p0 has two units adjacent at (0,0) and (1,0)
        const [id] = Object.keys(state.units).filter((k) => state.units[k]?.owner === 0);
        const targets = getAttackTargets(state, id!);
        expect(targets.every((u) => u.owner !== 0)).toBe(true);
    });
});

// ------------------------------------------------------------
// getNeighbors
// ------------------------------------------------------------

describe("getNeighbors", () => {
    it("returns 4 cardinal neighbors", () => {
        const neighbors = getNeighbors({ x: 3, y: 3 });
        expect(neighbors).toHaveLength(4);
        expect(neighbors).toContainEqual({ x: 3, y: 2 });
        expect(neighbors).toContainEqual({ x: 3, y: 4 });
        expect(neighbors).toContainEqual({ x: 2, y: 3 });
        expect(neighbors).toContainEqual({ x: 4, y: 3 });
    });

    it("includes negative coords at the edge (caller handles bounds)", () => {
        const neighbors = getNeighbors({ x: 0, y: 0 });
        expect(neighbors).toContainEqual({ x: -1, y: 0 });
        expect(neighbors).toContainEqual({ x: 0, y: -1 });
    });
});

// ------------------------------------------------------------
// manhattanDistance
// ------------------------------------------------------------

describe("manhattanDistance", () => {
    it("returns 0 for the same point", () => {
        expect(manhattanDistance({ x: 2, y: 3 }, { x: 2, y: 3 })).toBe(0);
    });

    it("calculates horizontal distance correctly", () => {
        expect(manhattanDistance({ x: 0, y: 0 }, { x: 5, y: 0 })).toBe(5);
    });

    it("calculates vertical distance correctly", () => {
        expect(manhattanDistance({ x: 0, y: 0 }, { x: 0, y: 3 })).toBe(3);
    });

    it("calculates diagonal distance correctly", () => {
        expect(manhattanDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(7);
    });

    it("is symmetric", () => {
        const a = { x: 1, y: 2 };
        const b = { x: 5, y: 7 };
        expect(manhattanDistance(a, b)).toBe(manhattanDistance(b, a));
    });
});

// ------------------------------------------------------------
// coordsEqual
// ------------------------------------------------------------

describe("coordsEqual", () => {
    it("returns true for identical coords", () => {
        expect(coordsEqual({ x: 3, y: 4 }, { x: 3, y: 4 })).toBe(true);
    });

    it("returns false when x differs", () => {
        expect(coordsEqual({ x: 3, y: 4 }, { x: 2, y: 4 })).toBe(false);
    });

    it("returns false when y differs", () => {
        expect(coordsEqual({ x: 3, y: 4 }, { x: 3, y: 5 })).toBe(false);
    });

    it("returns false when both differ", () => {
        expect(coordsEqual({ x: 0, y: 0 }, { x: 1, y: 1 })).toBe(false);
    });
});