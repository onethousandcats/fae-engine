// ============================================================
// FAE ENGINE — Layer 6: Renderer / Highlights
// Pure visual overlay for reachable tiles and attack targets.
// Reads from selectors only — never mutates state.
// ============================================================

import * as THREE from "three";
import type { GameState, Coords } from "../../../src/state/types";
import { getReachableTiles, getAttackTargets } from "../../../src/state/selectors";
import { worldPosition, TILE_SIZE } from "./map";

const MOVE_COLOR = 0x4ade80;   // green
const ATTACK_COLOR = 0xf87171; // red

export class HighlightRenderer {
    private group: THREE.Group;

    constructor() {
        this.group = new THREE.Group();
        this.group.name = "highlights";
    }

    getGroup(): THREE.Group {
        return this.group;
    }

    // ----------------------------------------------------------
    // show — renders reachable tiles and attack ranges for the
    // currently selected unit. Pass null to clear all highlights.
    // ----------------------------------------------------------

    show(state: GameState, selectedUnitId: string | null): void {
        this.clear();
        if (!selectedUnitId) return;

        const unit = state.units[selectedUnitId];
        if (!unit) return;

        const reachable = getReachableTiles(state, selectedUnitId);
        for (const coords of reachable) {
            this.addTile(coords, state.map, MOVE_COLOR);
        }

        const targets = getAttackTargets(state, selectedUnitId);
        for (const target of targets) {
            this.addTile(target.coords, state.map, ATTACK_COLOR);
        }
    }

    clear(): void {
        while (this.group.children.length > 0) {
            const child = this.group.children[0];
            if (!child) break;
            this.group.remove(child);
            if (child instanceof THREE.Mesh) {
                child.geometry.dispose();
                (child.material as THREE.Material).dispose();
            }
        }
    }

    private addTile(coords: Coords, map: GameState["map"], color: number): void {
        const geometry = new THREE.PlaneGeometry(TILE_SIZE * 0.85, TILE_SIZE * 0.85);
        const material = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.4,
            side: THREE.DoubleSide,
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.rotation.x = -Math.PI / 2;

        const pos = worldPosition(coords, map);
        mesh.position.set(pos.x, 0.05, pos.z);

        this.group.add(mesh);
    }
}