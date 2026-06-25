// ============================================================
// FAE ENGINE — Layer 3: Event Bridge
// Derives events by diffing before/after states.
// This keeps apply() pure — it has no knowledge of events.
// Usage:
//   const [nextState, events] = applyWithEvents(state, action);
//   emitter.emitAll(events);
// ============================================================

import type { GameState } from "../state/types";
import type { GameAction } from "../actions/types";
import type { GameEvent } from "./types";
import { apply } from "../actions/apply";
import { getUnit } from "../state/selectors";

// ------------------------------------------------------------
// applyWithEvents
// Wraps apply() and derives the event list from the diff.
// Returns [newState, events] — caller decides when to emit.
// ------------------------------------------------------------

export function applyWithEvents(
    state: GameState,
    action: GameAction
): [GameState, GameEvent[]] {
    const next = apply(state, action);
    const events = deriveEvents(state, next, action);
    return [next, events];
}

// ------------------------------------------------------------
// deriveEvents — pure diff between before and after state
// ------------------------------------------------------------

function deriveEvents(
    before: GameState,
    after: GameState,
    action: GameAction
): GameEvent[] {
    const events: GameEvent[] = [];

    switch (action.type) {
        case "MOVE": {
            events.push({
                type: "UNIT_MOVED",
                unitId: action.unitId,
                from: action.from,
                to: action.to,
            });
            break;
        }

        case "ATTACK": {
            const targetBefore = getUnit(before, action.targetId);
            const targetAfter = getUnit(after, action.targetId);

            if (!targetBefore || !targetAfter) break;

            const damage = targetBefore.hp - targetAfter.hp;

            events.push({
                type: "UNIT_ATTACKED",
                attackerId: action.attackerId,
                targetId: action.targetId,
                damage,
            });

            events.push({
                type: "UNIT_DAMAGED",
                unitId: action.targetId,
                damage,
                remainingHp: targetAfter.hp,
            });

            if (targetAfter.status === "defeated" && targetBefore.status !== "defeated") {
                events.push({
                    type: "UNIT_DEFEATED",
                    unitId: action.targetId,
                    owner: targetAfter.owner,
                    coords: targetAfter.coords,
                });
            }
            break;
        }

        case "END_TURN": {
            events.push({
                type: "TURN_ENDED",
                playerId: action.playerId,
                turn: before.turn,
            });

            events.push({
                type: "TURN_STARTED",
                playerId: after.activePlayer,
                turn: after.turn,
            });
            break;
        }

        case "WAIT": {
            // WAIT has no interesting event beyond state change.
            // Add a UNIT_WAITED event here if the renderer needs it.
            break;
        }
    }

    // Check for game over transition
    if (
        before.victoryState.status === "ongoing" &&
        after.victoryState.status !== "ongoing"
    ) {
        events.push({
            type: "GAME_OVER",
            winner:
                after.victoryState.status === "victory" ? after.victoryState.winner : null,
        });
    }

    return events;
}