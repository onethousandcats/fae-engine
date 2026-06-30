// ============================================================
// FAE ENGINE — Layer 6: Renderer / Input
// Translates mouse clicks into GameActions.
// NEVER mutates state directly — only emits intended actions
// for the caller to validate and apply.
// ============================================================

import * as THREE from "three";
import type { GameState, Coords, UnitID } from "../../../src/state/types";
import { getTile, getUnitAt, coordsEqual } from "../../../src/state/selectors";
import { moveAction, attackAction, type GameAction } from "../../../src/actions/types";
import type { SceneContext } from "./scene";

// ------------------------------------------------------------
// Selection state — lives in the renderer, NOT game state.
// This is UI-only state: "what has the player clicked so far."
// ------------------------------------------------------------

export type SelectionState = {
    selectedUnitId: UnitID | null;
};

export function createSelectionState(): SelectionState {
    return { selectedUnitId: null };
}

// ------------------------------------------------------------
// screenToGridCoords
// Raycasts from a mouse event against the map plane and
// returns the grid coordinates clicked, or null if off-map.
// ------------------------------------------------------------

export function screenToGridCoords(
    event: MouseEvent,
    ctx: SceneContext,
    state: GameState
): Coords | null {
    const rect = ctx.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
    );

    ctx.raycaster.setFromCamera(ndc, ctx.camera);

    // Intersect against a flat ground plane at y=0
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hitPoint = new THREE.Vector3();
    const hit = ctx.raycaster.ray.intersectPlane(plane, hitPoint);
    if (!hit) return null;

    const offsetX = -(state.map.width - 1) / 2;
    const offsetZ = -(state.map.height - 1) / 2;

    const gridX = Math.round(hitPoint.x - offsetX);
    const gridY = Math.round(hitPoint.z - offsetZ);

    const coords = { x: gridX, y: gridY };
    return getTile(state, coords) ? coords : null;
}

// ------------------------------------------------------------
// handleClick
// Core input -> action translation logic.
// Pure function: (state, selection, clickedCoords) -> intent
//
// Returns either:
//   - { type: "select", unitId }       — update selection only
//   - { type: "action", action }        — a GameAction to validate/apply
//   - { type: "clear" }                 — deselect
//   - null                              — no-op click
// ------------------------------------------------------------

export type ClickIntent =
    | { type: "select"; unitId: UnitID }
    | { type: "action"; action: GameAction }
    | { type: "clear" };

export function handleClick(
    state: GameState,
    selection: SelectionState,
    clickedCoords: Coords
): ClickIntent | null {
    const clickedUnit = getUnitAt(state, clickedCoords);

    // Nothing selected yet
    if (!selection.selectedUnitId) {
        if (clickedUnit && clickedUnit.owner === state.activePlayer) {
            return { type: "select", unitId: clickedUnit.id };
        }
        return null;
    }

    const selectedUnit = state.units[selection.selectedUnitId];
    if (!selectedUnit) return { type: "clear" };

    // Clicked the currently selected unit again — deselect
    if (clickedUnit && clickedUnit.id === selection.selectedUnitId) {
        return { type: "clear" };
    }

    // Clicked an enemy unit — attempt attack
    if (clickedUnit && clickedUnit.owner !== state.activePlayer) {
        return {
            type: "action",
            action: attackAction(selectedUnit.id, clickedUnit.id),
        };
    }

    // Clicked another friendly unit — switch selection
    if (clickedUnit && clickedUnit.owner === state.activePlayer) {
        return { type: "select", unitId: clickedUnit.id };
    }

    // Clicked empty tile — attempt move
    if (!clickedUnit && !coordsEqual(selectedUnit.coords, clickedCoords)) {
        return {
            type: "action",
            action: moveAction(selectedUnit.id, selectedUnit.coords, clickedCoords),
        };
    }

    return { type: "clear" };
}