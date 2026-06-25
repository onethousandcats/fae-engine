import { describe, it, expect, vi } from "vitest";
import { EventEmitter } from "../../src/events/emitter";
import { applyWithEvents } from "../../src/events/bridge";
import { createGameState, createFlatMap } from "../../src/state/factory";
import { moveAction, attackAction, endTurnAction } from "../../src/actions/types";
import type { GameEvent } from "../../src/events/types";

// ------------------------------------------------------------
// Shared fixture
// ------------------------------------------------------------

function makeGame() {
    return createGameState({
        map: createFlatMap(8, 8),
        player0Units: [{ class: "infantry", coords: { x: 0, y: 0 } }],
        player1Units: [{ class: "infantry", coords: { x: 1, y: 0 } }],
    });
}

function getP0Id(state: ReturnType<typeof makeGame>) {
    return Object.keys(state.units).find((id) => state.units[id]?.owner === 0)!;
}

function getP1Id(state: ReturnType<typeof makeGame>) {
    return Object.keys(state.units).find((id) => state.units[id]?.owner === 1)!;
}

// ------------------------------------------------------------
// EventEmitter — subscribe / unsubscribe
// ------------------------------------------------------------

describe("EventEmitter.on / off", () => {
    it("calls a handler when a matching event is emitted", () => {
        const emitter = new EventEmitter();
        const handler = vi.fn();

        emitter.on("UNIT_MOVED", handler);
        emitter.emit({ type: "UNIT_MOVED", unitId: "u1", from: { x: 0, y: 0 }, to: { x: 1, y: 0 } });

        expect(handler).toHaveBeenCalledOnce();
    });

    it("does not call a handler for a different event type", () => {
        const emitter = new EventEmitter();
        const handler = vi.fn();

        emitter.on("UNIT_DEFEATED", handler);
        emitter.emit({ type: "UNIT_MOVED", unitId: "u1", from: { x: 0, y: 0 }, to: { x: 1, y: 0 } });

        expect(handler).not.toHaveBeenCalled();
    });

    it("unsubscribe function removes the handler", () => {
        const emitter = new EventEmitter();
        const handler = vi.fn();

        const unsub = emitter.on("UNIT_MOVED", handler);
        unsub();
        emitter.emit({ type: "UNIT_MOVED", unitId: "u1", from: { x: 0, y: 0 }, to: { x: 1, y: 0 } });

        expect(handler).not.toHaveBeenCalled();
    });

    it("supports multiple handlers for the same event", () => {
        const emitter = new EventEmitter();
        const h1 = vi.fn();
        const h2 = vi.fn();

        emitter.on("TURN_ENDED", h1);
        emitter.on("TURN_ENDED", h2);
        emitter.emit({ type: "TURN_ENDED", playerId: 0, turn: 1 });

        expect(h1).toHaveBeenCalledOnce();
        expect(h2).toHaveBeenCalledOnce();
    });

    it("passes the event payload to the handler", () => {
        const emitter = new EventEmitter();
        let received: GameEvent | null = null;

        emitter.on("UNIT_DAMAGED", (e) => { received = e; });
        emitter.emit({ type: "UNIT_DAMAGED", unitId: "u1", damage: 5, remainingHp: 25 });

        expect(received).toMatchObject({ type: "UNIT_DAMAGED", damage: 5, remainingHp: 25 });
    });
});

// ------------------------------------------------------------
// EventEmitter — emitAll
// ------------------------------------------------------------

describe("EventEmitter.emitAll", () => {
    it("dispatches all events in order", () => {
        const emitter = new EventEmitter();
        const received: string[] = [];

        emitter.on("UNIT_MOVED", () => received.push("moved"));
        emitter.on("UNIT_ATTACKED", () => received.push("attacked"));
        emitter.on("UNIT_DAMAGED", () => received.push("damaged"));

        emitter.emitAll([
            { type: "UNIT_MOVED", unitId: "u1", from: { x: 0, y: 0 }, to: { x: 1, y: 0 } },
            { type: "UNIT_ATTACKED", attackerId: "u1", targetId: "u2", damage: 5 },
            { type: "UNIT_DAMAGED", unitId: "u2", damage: 5, remainingHp: 25 },
        ]);

        expect(received).toEqual(["moved", "attacked", "damaged"]);
    });
});

// ------------------------------------------------------------
// EventEmitter — clear
// ------------------------------------------------------------

describe("EventEmitter.clear", () => {
    it("clears handlers for a specific type", () => {
        const emitter = new EventEmitter();
        const handler = vi.fn();

        emitter.on("UNIT_DEFEATED", handler);
        emitter.clear("UNIT_DEFEATED");
        emitter.emit({ type: "UNIT_DEFEATED", unitId: "u1", owner: 0, coords: { x: 0, y: 0 } });

        expect(handler).not.toHaveBeenCalled();
    });

    it("clears all handlers when called with no argument", () => {
        const emitter = new EventEmitter();
        const h1 = vi.fn();
        const h2 = vi.fn();

        emitter.on("UNIT_MOVED", h1);
        emitter.on("UNIT_DEFEATED", h2);
        emitter.clear();

        emitter.emit({ type: "UNIT_MOVED", unitId: "u1", from: { x: 0, y: 0 }, to: { x: 1, y: 0 } });
        emitter.emit({ type: "UNIT_DEFEATED", unitId: "u1", owner: 0, coords: { x: 0, y: 0 } });

        expect(h1).not.toHaveBeenCalled();
        expect(h2).not.toHaveBeenCalled();
    });
});

// ------------------------------------------------------------
// EventEmitter — listenerCount
// ------------------------------------------------------------

describe("EventEmitter.listenerCount", () => {
    it("returns 0 for an event with no listeners", () => {
        const emitter = new EventEmitter();
        expect(emitter.listenerCount("GAME_OVER")).toBe(0);
    });

    it("returns correct count after subscribing", () => {
        const emitter = new EventEmitter();
        emitter.on("UNIT_MOVED", vi.fn());
        emitter.on("UNIT_MOVED", vi.fn());
        expect(emitter.listenerCount("UNIT_MOVED")).toBe(2);
    });

    it("decrements after unsubscribe", () => {
        const emitter = new EventEmitter();
        const unsub = emitter.on("UNIT_MOVED", vi.fn());
        unsub();
        expect(emitter.listenerCount("UNIT_MOVED")).toBe(0);
    });
});

// ------------------------------------------------------------
// applyWithEvents — MOVE
// ------------------------------------------------------------

describe("applyWithEvents — MOVE", () => {
    it("emits UNIT_MOVED with correct from/to", () => {
        const state = makeGame();
        const p0Id = getP0Id(state);

        const [, events] = applyWithEvents(state, moveAction(p0Id, { x: 0, y: 0 }, { x: 0, y: 1 }));

        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({
            type: "UNIT_MOVED",
            unitId: p0Id,
            from: { x: 0, y: 0 },
            to: { x: 0, y: 1 },
        });
    });

    it("returns the updated state alongside events", () => {
        const state = makeGame();
        const p0Id = getP0Id(state);

        const [next] = applyWithEvents(state, moveAction(p0Id, { x: 0, y: 0 }, { x: 0, y: 1 }));
        expect(next.units[p0Id]?.coords).toEqual({ x: 0, y: 1 });
    });
});

// ------------------------------------------------------------
// applyWithEvents — ATTACK
// ------------------------------------------------------------

describe("applyWithEvents — ATTACK", () => {
    it("emits UNIT_ATTACKED, UNIT_DAMAGED for a non-lethal hit", () => {
        const state = makeGame();
        const p0Id = getP0Id(state);
        const p1Id = getP1Id(state);

        // p0 infantry (3 atk) vs p1 infantry (2 def) = 1 damage — non-lethal vs 10hp
        const [, events] = applyWithEvents(state, attackAction(p0Id, p1Id));

        const types = events.map((e) => e.type);
        expect(types).toContain("UNIT_ATTACKED");
        expect(types).toContain("UNIT_DAMAGED");
        expect(types).not.toContain("UNIT_DEFEATED");
        expect(types).not.toContain("GAME_OVER");
    });

    it("emits UNIT_DEFEATED and GAME_OVER when kill shot lands", () => {
        const state = makeGame();
        const p0Id = getP0Id(state);
        const p1Id = getP1Id(state);

        // Wound target to 1hp
        const wounded = {
            ...state,
            units: { ...state.units, [p1Id]: { ...state.units[p1Id]!, hp: 1 } },
        };

        const [, events] = applyWithEvents(wounded, attackAction(p0Id, p1Id));
        const types = events.map((e) => e.type);

        expect(types).toContain("UNIT_DEFEATED");
        expect(types).toContain("GAME_OVER");
    });

    it("UNIT_ATTACKED carries the correct damage value", () => {
        const state = makeGame();
        const p0Id = getP0Id(state);
        const p1Id = getP1Id(state);

        const [, events] = applyWithEvents(state, attackAction(p0Id, p1Id));
        const attacked = events.find((e) => e.type === "UNIT_ATTACKED");

        expect(attacked).toMatchObject({ type: "UNIT_ATTACKED", damage: 1 }); // 3 - 2 = 1
    });

    it("GAME_OVER event names the correct winner", () => {
        const state = makeGame();
        const p0Id = getP0Id(state);
        const p1Id = getP1Id(state);

        const wounded = {
            ...state,
            units: { ...state.units, [p1Id]: { ...state.units[p1Id]!, hp: 1 } },
        };

        const [, events] = applyWithEvents(wounded, attackAction(p0Id, p1Id));
        const gameOver = events.find((e) => e.type === "GAME_OVER");

        expect(gameOver).toMatchObject({ type: "GAME_OVER", winner: 0 });
    });
});

// ------------------------------------------------------------
// applyWithEvents — END_TURN
// ------------------------------------------------------------

describe("applyWithEvents — END_TURN", () => {
    it("emits TURN_ENDED then TURN_STARTED", () => {
        const state = makeGame();
        const [, events] = applyWithEvents(state, endTurnAction(0));

        const types = events.map((e) => e.type);
        expect(types).toEqual(["TURN_ENDED", "TURN_STARTED"]);
    });

    it("TURN_ENDED carries the correct player and turn", () => {
        const state = makeGame();
        const [, events] = applyWithEvents(state, endTurnAction(0));
        const ended = events.find((e) => e.type === "TURN_ENDED");

        expect(ended).toMatchObject({ type: "TURN_ENDED", playerId: 0, turn: 1 });
    });

    it("TURN_STARTED carries the next player", () => {
        const state = makeGame();
        const [, events] = applyWithEvents(state, endTurnAction(0));
        const started = events.find((e) => e.type === "TURN_STARTED");

        expect(started).toMatchObject({ type: "TURN_STARTED", playerId: 1 });
    });
});

// ------------------------------------------------------------
// Full integration — emitter + bridge together
// ------------------------------------------------------------

describe("EventEmitter + applyWithEvents integration", () => {
    it("wires together cleanly for a move action", () => {
        const emitter = new EventEmitter();
        const handler = vi.fn();
        emitter.on("UNIT_MOVED", handler);

        const state = makeGame();
        const p0Id = getP0Id(state);

        const [, events] = applyWithEvents(state, moveAction(p0Id, { x: 0, y: 0 }, { x: 0, y: 1 }));
        emitter.emitAll(events);

        expect(handler).toHaveBeenCalledOnce();
        expect(handler).toHaveBeenCalledWith(expect.objectContaining({ type: "UNIT_MOVED" }));
    });

    it("multiple subscribers each receive the event", () => {
        const emitter = new EventEmitter();
        const h1 = vi.fn();
        const h2 = vi.fn();

        emitter.on("UNIT_DAMAGED", h1);
        emitter.on("UNIT_DAMAGED", h2);

        const state = makeGame();
        const p0Id = getP0Id(state);
        const p1Id = getP1Id(state);

        const [, events] = applyWithEvents(state, attackAction(p0Id, p1Id));
        emitter.emitAll(events);

        expect(h1).toHaveBeenCalled();
        expect(h2).toHaveBeenCalled();
    });

    it("unsubscribed handlers do not receive events", () => {
        const emitter = new EventEmitter();
        const handler = vi.fn();
        const unsub = emitter.on("UNIT_MOVED", handler);
        unsub();

        const state = makeGame();
        const p0Id = getP0Id(state);

        const [, events] = applyWithEvents(state, moveAction(p0Id, { x: 0, y: 0 }, { x: 0, y: 1 }));
        emitter.emitAll(events);

        expect(handler).not.toHaveBeenCalled();
    });
});