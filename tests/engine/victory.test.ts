import { describe, it, expect } from "vitest";
import { createGameState, createFlatMap } from "../../src/state/factory";
import { checkVictory, withVictoryCheck } from "../../src/engine/victory";
import { apply } from "../../src/actions/apply";
import { attackAction, endTurnAction } from "../../src/actions/types";

// ------------------------------------------------------------
// Fixtures
// ------------------------------------------------------------

function makeGame() {
    return createGameState({
        map: createFlatMap(8, 8),
        player0Units: [{ class: "infantry", coords: { x: 0, y: 0 } }],
        player1Units: [{ class: "infantry", coords: { x: 1, y: 0 } }],
    });
}

function killUnit(state: ReturnType<typeof makeGame>, unitId: string) {
    return {
        ...state,
        units: {
            ...state.units,
            [unitId]: { ...state.units[unitId]!, hp: 0, status: "defeated" as const },
        },
    };
}

// ------------------------------------------------------------
// Elimination
// ------------------------------------------------------------

describe("checkVictory — elimination", () => {
    it("returns ongoing when both players have living units", () => {
        const state = makeGame();
        expect(checkVictory(state)).toEqual({ status: "ongoing" });
    });

    it("returns victory for player 0 when all p1 units are dead", () => {
        const state = makeGame();
        const p1Id = Object.keys(state.units).find((id) => state.units[id]?.owner === 1)!;
        const result = checkVictory(killUnit(state, p1Id));

        expect(result).toEqual({ status: "victory", winner: 0 });
    });

    it("returns victory for player 1 when all p0 units are dead", () => {
        const state = makeGame();
        const p0Id = Object.keys(state.units).find((id) => state.units[id]?.owner === 0)!;
        const result = checkVictory(killUnit(state, p0Id));

        expect(result).toEqual({ status: "victory", winner: 1 });
    });

    it("returns draw when both players lose their last unit simultaneously", () => {
        const state = makeGame();
        const p0Id = Object.keys(state.units).find((id) => state.units[id]?.owner === 0)!;
        const p1Id = Object.keys(state.units).find((id) => state.units[id]?.owner === 1)!;

        const bothDead = killUnit(killUnit(state, p0Id), p1Id);
        expect(checkVictory(bothDead)).toEqual({ status: "draw" });
    });

    it("does not re-evaluate an already decided game", () => {
        const state = makeGame();
        const decided = {
            ...state,
            victoryState: { status: "victory" as const, winner: 0 as const },
        };
        expect(checkVictory(decided)).toEqual({ status: "victory", winner: 0 });
    });
});

// ------------------------------------------------------------
// Capture
// ------------------------------------------------------------

describe("checkVictory — capture", () => {
    const objectives = [
        { x: 3, y: 3 },
        { x: 4, y: 4 },
    ];

    it("returns ongoing when no objectives are held", () => {
        const state = makeGame();
        expect(checkVictory(state, { objectiveCoords: objectives })).toEqual({
            status: "ongoing",
        });
    });

    it("returns victory when player 0 holds all objectives", () => {
        const state = createGameState({
            map: createFlatMap(8, 8),
            player0Units: [
                { class: "infantry", coords: { x: 3, y: 3 } },
                { class: "infantry", coords: { x: 4, y: 4 } },
            ],
            player1Units: [{ class: "infantry", coords: { x: 7, y: 7 } }],
        });

        const result = checkVictory(state, { objectiveCoords: objectives });
        expect(result).toEqual({ status: "victory", winner: 0 });
    });

    it("returns victory when player 1 holds all objectives", () => {
        const state = createGameState({
            map: createFlatMap(8, 8),
            player0Units: [{ class: "infantry", coords: { x: 0, y: 0 } }],
            player1Units: [
                { class: "infantry", coords: { x: 3, y: 3 } },
                { class: "infantry", coords: { x: 4, y: 4 } },
            ],
        });

        const result = checkVictory(state, { objectiveCoords: objectives });
        expect(result).toEqual({ status: "victory", winner: 1 });
    });

    it("respects objectivesToWin threshold", () => {
        // Only need 1 of 2 objectives to win
        const state = createGameState({
            map: createFlatMap(8, 8),
            player0Units: [{ class: "infantry", coords: { x: 3, y: 3 } }],
            player1Units: [{ class: "infantry", coords: { x: 7, y: 7 } }],
        });

        const result = checkVictory(state, {
            objectiveCoords: objectives,
            objectivesToWin: 1,
        });
        expect(result).toEqual({ status: "victory", winner: 0 });
    });

    it("returns ongoing when objectives are partially held", () => {
        const state = createGameState({
            map: createFlatMap(8, 8),
            player0Units: [{ class: "infantry", coords: { x: 3, y: 3 } }],
            player1Units: [{ class: "infantry", coords: { x: 7, y: 7 } }],
        });

        // Need both objectives — only one held
        const result = checkVictory(state, { objectiveCoords: objectives });
        expect(result).toEqual({ status: "ongoing" });
    });

    it("returns draw when both players simultaneously hold enough objectives", () => {
        const state = createGameState({
            map: createFlatMap(8, 8),
            player0Units: [{ class: "infantry", coords: { x: 3, y: 3 } }],
            player1Units: [{ class: "infantry", coords: { x: 4, y: 4 } }],
        });

        // Each player holds 1, threshold is 1
        const result = checkVictory(state, {
            objectiveCoords: objectives,
            objectivesToWin: 1,
        });
        expect(result).toEqual({ status: "draw" });
    });
});

// ------------------------------------------------------------
// Turn limit
// ------------------------------------------------------------

describe("checkVictory — turn limit", () => {
    it("returns ongoing before the turn limit is reached", () => {
        const state = makeGame(); // turn 1
        expect(checkVictory(state, { turnLimit: 10 })).toEqual({ status: "ongoing" });
    });

    it("returns victory for player with higher HP when limit is reached", () => {
        const state = makeGame();
        const p1Id = Object.keys(state.units).find((id) => state.units[id]?.owner === 1)!;

        // Wound p1 unit, advance turn counter past limit
        const lateGame = {
            ...state,
            turn: 11,
            units: { ...state.units, [p1Id]: { ...state.units[p1Id]!, hp: 5 } },
        };

        const result = checkVictory(lateGame, { turnLimit: 10 });
        expect(result).toEqual({ status: "victory", winner: 0 });
    });

    it("returns draw when both players have equal HP at turn limit", () => {
        const state = makeGame(); // both infantry at 30hp
        const lateGame = { ...state, turn: 11 };

        const result = checkVictory(lateGame, { turnLimit: 10 });
        expect(result).toEqual({ status: "draw" });
    });

    it("turn limit ignored when not configured", () => {
        const state = { ...makeGame(), turn: 999 };
        expect(checkVictory(state)).toEqual({ status: "ongoing" });
    });
});

// ------------------------------------------------------------
// withVictoryCheck
// ------------------------------------------------------------

describe("withVictoryCheck", () => {
    it("patches state with victory when condition is met", () => {
        const state = makeGame();
        const p1Id = Object.keys(state.units).find((id) => state.units[id]?.owner === 1)!;
        const dead = killUnit(state, p1Id);

        const next = withVictoryCheck(dead);
        expect(next.victoryState).toEqual({ status: "victory", winner: 0 });
        expect(next.phase).toBe("game_over");
    });

    it("returns same state reference when no victory change", () => {
        const state = makeGame();
        const next = withVictoryCheck(state);
        expect(next).toBe(state); // same reference — no unnecessary copy
    });

    it("sets phase to game_over on victory", () => {
        const state = makeGame();
        const p1Id = Object.keys(state.units).find((id) => state.units[id]?.owner === 1)!;
        const next = withVictoryCheck(killUnit(state, p1Id));
        expect(next.phase).toBe("game_over");
    });

    it("works with capture config", () => {
        const state = createGameState({
            map: createFlatMap(8, 8),
            player0Units: [{ class: "infantry", coords: { x: 3, y: 3 } }],
            player1Units: [{ class: "infantry", coords: { x: 7, y: 7 } }],
        });

        const next = withVictoryCheck(state, {
            objectiveCoords: [{ x: 3, y: 3 }],
            objectivesToWin: 1,
        });

        expect(next.victoryState).toEqual({ status: "victory", winner: 0 });
    });
});

// ------------------------------------------------------------
// Integration — victory flows through apply()
// ------------------------------------------------------------

describe("victory integration with apply()", () => {
    it("game ends immediately when last enemy unit is killed", () => {
        const state = makeGame();
        const p0Id = Object.keys(state.units).find((id) => state.units[id]?.owner === 0)!;
        const p1Id = Object.keys(state.units).find((id) => state.units[id]?.owner === 1)!;

        const wounded = {
            ...state,
            units: { ...state.units, [p1Id]: { ...state.units[p1Id]!, hp: 1 } },
        };

        const next = apply(wounded, attackAction(p0Id, p1Id));
        expect(next.victoryState.status).toBe("victory");
        if (next.victoryState.status === "victory") {
            expect(next.victoryState.winner).toBe(0);
        }
        expect(next.phase).toBe("game_over");
    });

    it("no further actions are valid after game over", () => {
        const state = makeGame();
        const p0Id = Object.keys(state.units).find((id) => state.units[id]?.owner === 0)!;
        const p1Id = Object.keys(state.units).find((id) => state.units[id]?.owner === 1)!;

        const wounded = {
            ...state,
            units: { ...state.units, [p1Id]: { ...state.units[p1Id]!, hp: 1 } },
        };
        const finished = apply(wounded, attackAction(p0Id, p1Id));

        expect(() => apply(finished, endTurnAction(0))).toThrow();
    });
});