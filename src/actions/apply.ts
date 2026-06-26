// ============================================================
// FAE ENGINE — Layer 2: State Transition
// Pure function: apply(state, action) → newState
// No side effects. No mutation. Returns a new GameState.
// This is the heart of the engine.
// ============================================================

import type { GameState, Unit, PlayerID } from "../state/types";
import type { GameAction, MoveAction, AttackAction, WaitAction, EndTurnAction } from "./types";
import { validate } from "./validate";
import { getUnit, getPlayerUnits } from "../state/selectors";
import { withVictoryCheck } from "../engine/victory";

// ------------------------------------------------------------
// Public API
// apply() validates first, then transitions.
// Throws if the action is illegal — callers should validate
// first if they want a soft failure path.
// ------------------------------------------------------------

export function apply(state: GameState, action: GameAction): GameState {
    const result = validate(state, action);
    if (!result.valid) {
        throw new Error(`Illegal action [${action.type}]: ${result.reason}`);
    }

    switch (action.type) {
        case "MOVE": return applyMove(state, action);
        case "ATTACK": return applyAttack(state, action);
        case "WAIT": return applyWait(state, action);
        case "END_TURN": return applyEndTurn(state, action);
    }
}

// ------------------------------------------------------------
// Immutable helpers
// ------------------------------------------------------------

function updateUnit(state: GameState, unitId: string, patch: Partial<Unit>): GameState {
    const unit = state.units[unitId];
    if (!unit) return state;
    return {
        ...state,
        units: {
            ...state.units,
            [unitId]: { ...unit, ...patch },
        },
    };
}

function appendHistory(state: GameState, entry: string): GameState {
    return { ...state, history: [...state.history, entry] };
}

// ------------------------------------------------------------
// MOVE
// ------------------------------------------------------------

function applyMove(state: GameState, action: MoveAction): GameState {
    let next = updateUnit(state, action.unitId, {
        coords: action.to,
        hasMoved: true,
        status: "moved",
    });

    next = appendHistory(next, `MOVE:${action.unitId}:${action.to.x},${action.to.y}`);
    next = { ...next, phase: "unit_phase" };

    return next;
}

// ------------------------------------------------------------
// ATTACK
// ------------------------------------------------------------

function applyAttack(state: GameState, action: AttackAction): GameState {
    const attacker = getUnit(state, action.attackerId);
    const target = getUnit(state, action.targetId);
    if (!attacker || !target) return state;

    // Damage formula: attacker.attack - target.defense, minimum 1
    const rawDamage = attacker.stats.attack - target.stats.defense;
    const damage = Math.max(1, rawDamage);
    const newHp = Math.max(0, target.hp - damage);
    const isDefeated = newHp === 0;

    // Apply damage to target
    let next = updateUnit(state, action.targetId, {
        hp: newHp,
        status: isDefeated ? "defeated" : target.status,
    });

    // Mark attacker as having acted
    next = updateUnit(next, action.attackerId, {
        hasActed: true,
        status: attacker.hasMoved ? "acted" : attacker.status,
    });

    next = appendHistory(next, `ATTACK:${action.attackerId}->${action.targetId}:${damage}dmg`);
    next = { ...next, phase: "unit_phase" };

    // Check win condition after every attack
    next = withVictoryCheck(next);

    return next;
}

// ------------------------------------------------------------
// WAIT
// ------------------------------------------------------------

function applyWait(state: GameState, action: WaitAction): GameState {
    let next = updateUnit(state, action.unitId, {
        hasActed: true,
        hasMoved: true,
        status: "acted",
    });

    next = appendHistory(next, `WAIT:${action.unitId}`);
    next = { ...next, phase: "unit_phase" };

    return next;
}

// ------------------------------------------------------------
// END TURN
// ------------------------------------------------------------

function applyEndTurn(state: GameState, action: EndTurnAction): GameState {
    // Reset all units for the active player
    let next = state;
    const currentUnits = getPlayerUnits(state, action.playerId);

    for (const unit of currentUnits) {
        if (unit.status !== "defeated") {
            next = updateUnit(next, unit.id, {
                hasMoved: false,
                hasActed: false,
                status: "idle",
            });
        }
    }

    // Advance to next player
    const nextPlayer: PlayerID = action.playerId === 0 ? 1 : 0;

    // Increment turn counter when player 1 ends (full round complete)
    const nextTurn = action.playerId === 1 ? state.turn + 1 : state.turn;

    next = {
        ...next,
        activePlayer: nextPlayer,
        turn: nextTurn,
        phase: "start_turn",
    };

    next = appendHistory(next, `END_TURN:player${action.playerId}:turn${state.turn}`);

    // Immediately advance through start_turn to player_phase
    // (start_turn is where you'd apply income, status ticks, etc.)
    next = applyStartTurn(next);

    return next;
}

// ------------------------------------------------------------
// START TURN (internal — not a player action)
// Runs automatically at the start of each player's turn.
// Apply income, tick status effects, trigger events here later.
// ------------------------------------------------------------

function applyStartTurn(state: GameState): GameState {
    // Tick status effects on the newly active player's units
    let next = state;
    const units = getPlayerUnits(state, state.activePlayer);

    for (const unit of units) {
        if (unit.status === "stunned") {
            next = updateUnit(next, unit.id, { status: "idle" });
        }
    }

    return { ...next, phase: "player_phase" };
}