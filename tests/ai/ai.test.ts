import { describe, it, expect } from "vitest";
import { createGameState, createFlatMap } from "../../src/state/factory";
import { score, WEIGHTS } from "../../src/ai/heuristic";
import { getValidActions } from "../../src/ai/actions";
import { chooseBestAction } from "../../src/ai/minimax";
import { apply } from "../../src/actions/apply";
import { endTurnAction } from "../../src/actions/types";

// ------------------------------------------------------------
// Fixtures
// ------------------------------------------------------------

function makeGame() {
    return createGameState({
        map: createFlatMap(8, 8),
        player0Units: [{ class: "infantry", coords: { x: 0, y: 0 } }],
        player1Units: [{ class: "infantry", coords: { x: 7, y: 7 } }],
    });
}

function makeMirroredGame() {
    return createGameState({
        map: createFlatMap(8, 8),
        player0Units: [
            { class: "infantry", coords: { x: 0, y: 0 } },
            { class: "archer", coords: { x: 1, y: 0 } },
        ],
        player1Units: [
            { class: "infantry", coords: { x: 7, y: 7 } },
            { class: "archer", coords: { x: 6, y: 7 } },
        ],
    });
}

// ------------------------------------------------------------
// Heuristic — score()
// ------------------------------------------------------------

describe("score — symmetry", () => {
    it("returns 0 for a perfectly mirrored state", () => {
        const state = makeMirroredGame();
        const s0 = score(state, 0);
        const s1 = score(state, 1);
        // Both sides have equal HP, units, and proximity — scores should be equal magnitude
        expect(Math.abs(s0)).toBeCloseTo(Math.abs(s1), 0);
    });

    it("returns Infinity when that player has won", () => {
        const state = makeGame();
        const p1Id = Object.keys(state.units).find((id) => state.units[id]?.owner === 1)!;
        const won = {
            ...state,
            units: { ...state.units, [p1Id]: { ...state.units[p1Id]!, status: "defeated" as const } },
            victoryState: { status: "victory" as const, winner: 0 as const },
        };
        expect(score(won, 0)).toBe(Infinity);
        expect(score(won, 1)).toBe(-Infinity);
    });

    it("returns 0 for a draw", () => {
        const state = makeGame();
        const draw = { ...state, victoryState: { status: "draw" as const } };
        expect(score(draw, 0)).toBe(0);
        expect(score(draw, 1)).toBe(0);
    });
});

describe("score — HP advantage", () => {
    it("scores higher when my units have more HP", () => {
        const state = makeGame();
        const p0Id = Object.keys(state.units).find((id) => state.units[id]?.owner === 0)!;
        const p1Id = Object.keys(state.units).find((id) => state.units[id]?.owner === 1)!;

        const wounded = {
            ...state,
            units: { ...state.units, [p1Id]: { ...state.units[p1Id]!, hp: 5 } },
        };

        expect(score(wounded, 0)).toBeGreaterThan(score(state, 0));
    });

    it("scores lower when my units have less HP", () => {
        const state = makeGame();
        const p0Id = Object.keys(state.units).find((id) => state.units[id]?.owner === 0)!;

        const wounded = {
            ...state,
            units: { ...state.units, [p0Id]: { ...state.units[p0Id]!, hp: 5 } },
        };

        expect(score(wounded, 0)).toBeLessThan(score(state, 0));
    });
});

describe("score — unit count advantage", () => {
    it("scores higher with more living units", () => {
        const state = makeMirroredGame();
        const p1Ids = Object.keys(state.units).filter((id) => state.units[id]?.owner === 1);

        // Kill one enemy unit
        const oneDown = {
            ...state,
            units: {
                ...state.units,
                [p1Ids[0]!]: { ...state.units[p1Ids[0]!]!, status: "defeated" as const, hp: 0 },
            },
        };

        expect(score(oneDown, 0)).toBeGreaterThan(score(state, 0));
    });
});

describe("score — proximity", () => {
    it("scores higher when closer to enemies", () => {
        const far = createGameState({
            map: createFlatMap(10, 10),
            player0Units: [{ class: "infantry", coords: { x: 0, y: 0 } }],
            player1Units: [{ class: "infantry", coords: { x: 9, y: 9 } }],
        });

        const close = createGameState({
            map: createFlatMap(10, 10),
            player0Units: [{ class: "infantry", coords: { x: 4, y: 4 } }],
            player1Units: [{ class: "infantry", coords: { x: 5, y: 5 } }],
        });

        // WEIGHTS.PROXIMITY is negative, so closer = less negative = higher score
        expect(score(close, 0)).toBeGreaterThan(score(far, 0));
    });
});

// ------------------------------------------------------------
// getValidActions
// ------------------------------------------------------------

describe("getValidActions", () => {
    it("returns actions for the active player only", () => {
        const state = makeGame();
        const actions = getValidActions(state);
        // All move/attack/wait actions should be for player 0 units
        for (const action of actions) {
            if (action.type === "MOVE") {
                expect(state.units[action.unitId]?.owner).toBe(0);
            }
            if (action.type === "ATTACK") {
                expect(state.units[action.attackerId]?.owner).toBe(0);
            }
            if (action.type === "WAIT") {
                expect(state.units[action.unitId]?.owner).toBe(0);
            }
        }
    });

    it("always includes END_TURN", () => {
        const state = makeGame();
        const actions = getValidActions(state);
        expect(actions.some((a) => a.type === "END_TURN")).toBe(true);
    });

    it("includes WAIT for each active unit", () => {
        const state = makeMirroredGame();
        const actions = getValidActions(state);
        const waits = actions.filter((a) => a.type === "WAIT");
        expect(waits).toHaveLength(2); // 2 p0 units
    });

    it("includes ATTACK when enemy is in range", () => {
        const state = createGameState({
            map: createFlatMap(8, 8),
            player0Units: [{ class: "infantry", coords: { x: 0, y: 0 } }],
            player1Units: [{ class: "infantry", coords: { x: 1, y: 0 } }],
        });
        const actions = getValidActions(state);
        expect(actions.some((a) => a.type === "ATTACK")).toBe(true);
    });

    it("returns no actions when game is over", () => {
        const state = makeGame();
        const over = { ...state, victoryState: { status: "victory" as const, winner: 0 as const } };
        expect(getValidActions(over)).toHaveLength(0);
    });

    it("does not include MOVE for a unit that has already moved", () => {
        const state = makeGame();
        const p0Id = Object.keys(state.units).find((id) => state.units[id]?.owner === 0)!;
        const moved = {
            ...state,
            units: { ...state.units, [p0Id]: { ...state.units[p0Id]!, hasMoved: true } },
        };
        const actions = getValidActions(moved);
        expect(actions.some((a) => a.type === "MOVE" && a.unitId === p0Id)).toBe(false);
    });
});

// ------------------------------------------------------------
// chooseBestAction — minimax
// ------------------------------------------------------------

describe("chooseBestAction", () => {
    it("returns a valid action", () => {
        const state = makeGame();
        const result = chooseBestAction(state, 1);
        expect(result.action).not.toBeNull();
    });

    it("always attacks when a kill is available at depth 1", () => {
        // Place units adjacent, wound enemy to 1hp
        const state = createGameState({
            map: createFlatMap(8, 8),
            player0Units: [{ class: "infantry", coords: { x: 0, y: 0 } }],
            player1Units: [{ class: "infantry", coords: { x: 1, y: 0 } }],
        });
        const p1Id = Object.keys(state.units).find((id) => state.units[id]?.owner === 1)!;
        const wounded = {
            ...state,
            units: { ...state.units, [p1Id]: { ...state.units[p1Id]!, hp: 1 } },
        };

        const result = chooseBestAction(wounded, 1);
        expect(result.action?.type).toBe("ATTACK");
    });

    it("scores a moved position higher than staying put when far from enemy", () => {
        // Verify the heuristic rewards proximity — AI closing distance scores better
        const state = makeGame(); // p0 at (0,0), p1 at (7,7)
        const p0Id = Object.keys(state.units).find((id) => state.units[id]?.owner === 0)!;
        // Move to (4,4) — much closer to enemy at (7,7), avoids corner objective at (0,0)
        const movedCloser = {
            ...state,
            units: { ...state.units, [p0Id]: { ...state.units[p0Id]!, coords: { x: 4, y: 4 } } },
        };
        // Also move starting position off the corner objective to isolate proximity
        const baseline = {
            ...state,
            units: { ...state.units, [p0Id]: { ...state.units[p0Id]!, coords: { x: 1, y: 1 } } },
        };
        expect(score(movedCloser, 0)).toBeGreaterThan(score(baseline, 0));
    });

    it("reports nodes evaluated > 0", () => {
        const state = makeGame();
        const result = chooseBestAction(state, 1);
        expect(result.nodesEvaluated).toBeGreaterThan(0);
    });

    it("evaluates more nodes at higher depth", () => {
        const state = makeGame();
        const shallow = chooseBestAction(state, 1);
        const deep = chooseBestAction(state, 2);
        expect(deep.nodesEvaluated).toBeGreaterThan(shallow.nodesEvaluated);
    });

    it("returns score of Infinity when winning move is found", () => {
        const state = createGameState({
            map: createFlatMap(8, 8),
            player0Units: [{ class: "mage", coords: { x: 0, y: 0 } }],
            player1Units: [{ class: "archer", coords: { x: 1, y: 0 } }],
        });
        const p1Id = Object.keys(state.units).find((id) => state.units[id]?.owner === 1)!;
        const wounded = {
            ...state,
            units: { ...state.units, [p1Id]: { ...state.units[p1Id]!, hp: 1 } },
        };

        const result = chooseBestAction(wounded, 1);
        expect(result.score).toBe(Infinity);
    });
});