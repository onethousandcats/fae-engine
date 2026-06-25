// ============================================================
// FAE ENGINE — Layer 3: Event Types
// Events are emitted after state transitions.
// They are plain data — no logic, no side effects.
// ============================================================

import type { UnitID, PlayerID, Coords } from "../state/types";

// ------------------------------------------------------------
// Event type discriminator
// ------------------------------------------------------------

export type GameEventType =
    | "UNIT_MOVED"
    | "UNIT_ATTACKED"
    | "UNIT_DAMAGED"
    | "UNIT_DEFEATED"
    | "UNIT_STUNNED"
    | "TURN_STARTED"
    | "TURN_ENDED"
    | "GAME_OVER";

// ------------------------------------------------------------
// Individual event shapes
// ------------------------------------------------------------

export type UnitMovedEvent = {
    readonly type: "UNIT_MOVED";
    readonly unitId: UnitID;
    readonly from: Coords;
    readonly to: Coords;
};

export type UnitAttackedEvent = {
    readonly type: "UNIT_ATTACKED";
    readonly attackerId: UnitID;
    readonly targetId: UnitID;
    readonly damage: number;
};

export type UnitDamagedEvent = {
    readonly type: "UNIT_DAMAGED";
    readonly unitId: UnitID;
    readonly damage: number;
    readonly remainingHp: number;
};

export type UnitDefeatedEvent = {
    readonly type: "UNIT_DEFEATED";
    readonly unitId: UnitID;
    readonly owner: PlayerID;
    readonly coords: Coords;
};

export type UnitStunnedEvent = {
    readonly type: "UNIT_STUNNED";
    readonly unitId: UnitID;
};

export type TurnStartedEvent = {
    readonly type: "TURN_STARTED";
    readonly playerId: PlayerID;
    readonly turn: number;
};

export type TurnEndedEvent = {
    readonly type: "TURN_ENDED";
    readonly playerId: PlayerID;
    readonly turn: number;
};

export type GameOverEvent = {
    readonly type: "GAME_OVER";
    readonly winner: PlayerID | null; // null = draw
};

// ------------------------------------------------------------
// Union — everything the event system can emit
// ------------------------------------------------------------

export type GameEvent =
    | UnitMovedEvent
    | UnitAttackedEvent
    | UnitDamagedEvent
    | UnitDefeatedEvent
    | UnitStunnedEvent
    | TurnStartedEvent
    | TurnEndedEvent
    | GameOverEvent;

// ------------------------------------------------------------
// Handler type
// ------------------------------------------------------------

export type EventHandler<T extends GameEvent = GameEvent> = (event: T) => void;