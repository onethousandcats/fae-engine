// ============================================================
// FAE ENGINE — Layer 2: Actions
// Pure data structures. No logic. No methods.
// Actions are the only way game state ever changes.
// ============================================================

import type { UnitID, Coords, PlayerID } from "../state/types";

// ------------------------------------------------------------
// Action types
// ------------------------------------------------------------

export type ActionType =
    | "MOVE"
    | "ATTACK"
    | "END_TURN"
    | "WAIT";       // unit skips its action, marks itself done

// ------------------------------------------------------------
// Individual action shapes
// ------------------------------------------------------------

export type MoveAction = {
    readonly type: "MOVE";
    readonly unitId: UnitID;
    readonly from: Coords;
    readonly to: Coords;
};

export type AttackAction = {
    readonly type: "ATTACK";
    readonly attackerId: UnitID;
    readonly targetId: UnitID;
};

export type WaitAction = {
    readonly type: "WAIT";
    readonly unitId: UnitID;
};

export type EndTurnAction = {
    readonly type: "END_TURN";
    readonly playerId: PlayerID;
};

// ------------------------------------------------------------
// Union — everything the engine can receive
// ------------------------------------------------------------

export type GameAction =
    | MoveAction
    | AttackAction
    | WaitAction
    | EndTurnAction;

// ------------------------------------------------------------
// Action creators — convenience functions, not required
// These just save typing. The plain objects are the real thing.
// ------------------------------------------------------------

export function moveAction(unitId: UnitID, from: Coords, to: Coords): MoveAction {
    return { type: "MOVE", unitId, from, to };
}

export function attackAction(attackerId: UnitID, targetId: UnitID): AttackAction {
    return { type: "ATTACK", attackerId, targetId };
}

export function waitAction(unitId: UnitID): WaitAction {
    return { type: "WAIT", unitId };
}

export function endTurnAction(playerId: PlayerID): EndTurnAction {
    return { type: "END_TURN", playerId };
}