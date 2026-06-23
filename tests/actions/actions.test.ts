import { describe, it, expect } from "vitest";
import { createGameState, createFlatMap } from "../../src/state/factory";
import { validate } from "../../src/actions/validate";
import { apply } from "../../src/actions/apply";
import { moveAction, attackAction, waitAction, endTurnAction } from "../../src/actions/types";

// ------------------------------------------------------------
// Shared test fixture
// ------------------------------------------------------------

function makeGame() {
    return createGameState({
        map: createFlatMap(8, 8),
        player0Units: [
            { class: "infantry", coords: { x: 0, y: 0 } },
        ],
        player1Units: [
            { class: "infantry", coords: { x: 2, y: 0 } }, // 2 tiles away — in attack range after move
        ],
    });
}

// ------------------------------------------------------------
// MOVE
// ------------------------------------------------------------

describe("MOVE", () => {
    it("allows a valid move within range", () => {
        const state = makeGame();
        const [unitId] = Object.keys(state.units).filter(
            (id) => state.units[id]?.owner === 0
        );
        const action = moveAction(unitId!, { x: 0, y: 0 }, { x: 1, y: 0 });

        expect(validate(state, action)).toEqual({ valid: true });

        const next = apply(state, action);
        expect(next.units[unitId!]?.coords).toEqual({ x: 1, y: 0 });
        expect(next.units[unitId!]?.hasMoved).toBe(true);
        expect(next.units[unitId!]?.status).toBe("moved");
    });

    it("rejects a move beyond movement range", () => {
        const state = makeGame();
        const [unitId] = Object.keys(state.units).filter(
            (id) => state.units[id]?.owner === 0
        );
        // Infantry has moveRange 4 — x:7 is 7 tiles away
        const action = moveAction(unitId!, { x: 0, y: 0 }, { x: 7, y: 0 });
        const result = validate(state, action);

        expect(result.valid).toBe(false);
        if (!result.valid) {
            expect(result.reason).toMatch(/reachable/i);
        }
    });

    it("rejects a second move from the same unit", () => {
        const state = makeGame();
        const [unitId] = Object.keys(state.units).filter(
            (id) => state.units[id]?.owner === 0
        );
        const first = apply(state, moveAction(unitId!, { x: 0, y: 0 }, { x: 1, y: 0 }));
        const result = validate(first, moveAction(unitId!, { x: 1, y: 0 }, { x: 2, y: 0 }));

        expect(result.valid).toBe(false);
        if (!result.valid) {
            expect(result.reason).toMatch(/already moved/i);
        }
    });

    it("rejects moving the opponent's unit", () => {
        const state = makeGame();
        const [enemyId] = Object.keys(state.units).filter(
            (id) => state.units[id]?.owner === 1
        );
        const result = validate(state, moveAction(enemyId!, { x: 2, y: 0 }, { x: 3, y: 0 }));

        expect(result.valid).toBe(false);
    });
});

// ------------------------------------------------------------
// ATTACK
// ------------------------------------------------------------

describe("ATTACK", () => {
    it("deals damage and marks attacker as acted", () => {
        const state = makeGame();
        const p0Id = Object.keys(state.units).find((id) => state.units[id]?.owner === 0)!;
        const p1Id = Object.keys(state.units).find((id) => state.units[id]?.owner === 1)!;

        // Move p0 adjacent to p1 first
        const afterMove = apply(state, moveAction(p0Id, { x: 0, y: 0 }, { x: 1, y: 0 }));
        const afterAttack = apply(afterMove, attackAction(p0Id, p1Id));

        const target = afterAttack.units[p1Id]!;
        const attacker = afterAttack.units[p0Id]!;

        expect(target.hp).toBeLessThan(30);
        expect(attacker.hasActed).toBe(true);
        expect(attacker.status).toBe("acted");
    });

    it("kills a unit when hp reaches 0", () => {
        // Mage has 14 attack vs infantry 6 defense = 8 dmg per hit
        // Infantry has 30hp — need multiple hits, so use a weakened state
        const state = createGameState({
            map: createFlatMap(8, 8),
            player0Units: [{ class: "mage", coords: { x: 0, y: 0 } }],
            player1Units: [{ class: "archer", coords: { x: 1, y: 0 } }], // archer: 20hp, 3 def → mage deals 11
        });

        const mageId = Object.keys(state.units).find((id) => state.units[id]?.owner === 0)!;
        const archerId = Object.keys(state.units).find((id) => state.units[id]?.owner === 1)!;

        // Manually wound the archer to 1hp
        const wounded = {
            ...state,
            units: {
                ...state.units,
                [archerId]: { ...state.units[archerId]!, hp: 1 },
            },
        };

        const next = apply(wounded, attackAction(mageId, archerId));
        expect(next.units[archerId]?.status).toBe("defeated");
    });

    it("ends the game when last enemy unit dies", () => {
        const state = createGameState({
            map: createFlatMap(8, 8),
            player0Units: [{ class: "mage", coords: { x: 0, y: 0 } }],
            player1Units: [{ class: "archer", coords: { x: 1, y: 0 } }],
        });

        const mageId = Object.keys(state.units).find((id) => state.units[id]?.owner === 0)!;
        const archerId = Object.keys(state.units).find((id) => state.units[id]?.owner === 1)!;

        const wounded = {
            ...state,
            units: { ...state.units, [archerId]: { ...state.units[archerId]!, hp: 1 } },
        };

        const next = apply(wounded, attackAction(mageId, archerId));
        expect(next.victoryState.status).toBe("victory");
        if (next.victoryState.status === "victory") {
            expect(next.victoryState.winner).toBe(0);
        }
        expect(next.phase).toBe("game_over");
    });

    it("rejects attacking an out-of-range target", () => {
        const state = makeGame();
        const p0Id = Object.keys(state.units).find((id) => state.units[id]?.owner === 0)!;
        const p1Id = Object.keys(state.units).find((id) => state.units[id]?.owner === 1)!;

        // p0 at (0,0), p1 at (2,0) — infantry melee range is 1
        const result = validate(state, attackAction(p0Id, p1Id));
        expect(result.valid).toBe(false);
    });
});

// ------------------------------------------------------------
// WAIT
// ------------------------------------------------------------

describe("WAIT", () => {
    it("marks unit as done", () => {
        const state = makeGame();
        const p0Id = Object.keys(state.units).find((id) => state.units[id]?.owner === 0)!;

        const next = apply(state, waitAction(p0Id));
        expect(next.units[p0Id]?.status).toBe("acted");
        expect(next.units[p0Id]?.hasActed).toBe(true);
        expect(next.units[p0Id]?.hasMoved).toBe(true);
    });
});

// ------------------------------------------------------------
// END TURN
// ------------------------------------------------------------

describe("END_TURN", () => {
    it("switches the active player", () => {
        const state = makeGame();
        const next = apply(state, endTurnAction(0));

        expect(next.activePlayer).toBe(1);
        expect(next.phase).toBe("player_phase");
    });

    it("increments turn counter after both players act", () => {
        const state = makeGame();
        const afterP0 = apply(state, endTurnAction(0));
        const afterP1 = apply(afterP0, endTurnAction(1));

        expect(afterP1.turn).toBe(2);
        expect(afterP1.activePlayer).toBe(0);
    });

    it("rejects end turn from the wrong player", () => {
        const state = makeGame();
        const result = validate(state, endTurnAction(1));

        expect(result.valid).toBe(false);
    });

    it("resets unit status for the next player's turn", () => {
        const state = makeGame();
        const p0Id = Object.keys(state.units).find((id) => state.units[id]?.owner === 0)!;

        const afterWait = apply(state, waitAction(p0Id));
        expect(afterWait.units[p0Id]?.status).toBe("acted");

        // End p0 turn, end p1 turn — p0 should be reset
        const afterP0End = apply(afterWait, endTurnAction(0));
        const afterP1End = apply(afterP0End, endTurnAction(1));

        expect(afterP1End.units[p0Id]?.status).toBe("idle");
        expect(afterP1End.units[p0Id]?.hasMoved).toBe(false);
        expect(afterP1End.units[p0Id]?.hasActed).toBe(false);
    });
});