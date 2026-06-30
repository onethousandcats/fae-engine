// ============================================================
// FAE ENGINE — Layer 6: Renderer / Units
// Pure read of Unit[] → Three.js meshes.
// Owns a mesh cache so it can diff and update rather than
// rebuild every frame. Still has zero game logic.
// ============================================================

import * as THREE from "three";
import type { GameMap, Unit, UnitClass, UnitID, PlayerID } from "../../../src/state/types";
import { worldPosition } from "./map";

// ------------------------------------------------------------
// Visual mapping — class to geometry, owner to color
// ------------------------------------------------------------

const PLAYER_COLORS: Record<PlayerID, number> = {
    0: 0x3b82f6, // blue
    1: 0xef4444, // red
};

function buildGeometry(unitClass: UnitClass): THREE.BufferGeometry {
    switch (unitClass) {
        case "infantry":
            return new THREE.BoxGeometry(0.5, 0.7, 0.5);
        case "archer":
            return new THREE.ConeGeometry(0.3, 0.8, 8);
        case "cavalry":
            return new THREE.CylinderGeometry(0.25, 0.35, 0.9, 8);
        case "mage":
            return new THREE.OctahedronGeometry(0.4, 0);
    }
}

// ------------------------------------------------------------
// UnitRenderer
// Maintains a mesh per unit, keyed by UnitID.
// sync() reconciles the mesh set against the current units.
// ------------------------------------------------------------

export class UnitRenderer {
    private group: THREE.Group;
    private meshes: Map<UnitID, THREE.Mesh>;
    private map: GameMap;

    constructor(map: GameMap) {
        this.group = new THREE.Group();
        this.group.name = "units";
        this.meshes = new Map();
        this.map = map;
    }

    getGroup(): THREE.Group {
        return this.group;
    }

    // ----------------------------------------------------------
    // sync — pure read of unit state, no logic, just visuals
    // Call this once per frame (or once per state change).
    // ----------------------------------------------------------

    sync(units: Record<UnitID, Unit>): void {
        const liveIds = new Set(Object.keys(units));

        // Remove meshes for units no longer present (dead/removed)
        for (const [id, mesh] of this.meshes) {
            const unit = units[id];
            if (!liveIds.has(id) || unit?.status === "defeated") {
                this.group.remove(mesh);
                mesh.geometry.dispose();
                (mesh.material as THREE.Material).dispose();
                this.meshes.delete(id);
            }
        }

        // Add or update meshes for living units
        for (const unit of Object.values(units)) {
            if (unit.status === "defeated") continue;

            let mesh = this.meshes.get(unit.id);
            if (!mesh) {
                mesh = this.createMesh(unit);
                this.meshes.set(unit.id, mesh);
                this.group.add(mesh);
            }

            this.updateMesh(mesh, unit);
        }
    }

    // ----------------------------------------------------------
    // createMesh — builds a new mesh for a unit
    // ----------------------------------------------------------

    private createMesh(unit: Unit): THREE.Mesh {
        const geometry = buildGeometry(unit.class);
        const material = new THREE.MeshStandardMaterial({
            color: PLAYER_COLORS[unit.owner],
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.userData = { type: "unit", unitId: unit.id };
        return mesh;
    }

    // ----------------------------------------------------------
    // updateMesh — syncs position, opacity (for done/dimmed
    // units), and any other per-frame visual state
    // ----------------------------------------------------------

    private updateMesh(mesh: THREE.Mesh, unit: Unit): void {
        const pos = worldPosition(unit.coords, this.map);
        const yOffset = unit.class === "archer" ? 0.4 : 0.45;
        mesh.position.set(pos.x, yOffset, pos.z);

        const material = mesh.material as THREE.MeshStandardMaterial;

        // Dim units that have used their action this turn
        material.opacity = unit.status === "acted" ? 0.5 : 1.0;
        material.transparent = unit.status === "acted";

        // Tint stunned units
        if (unit.status === "stunned") {
            material.color.setHex(0x9333ea);
        } else {
            material.color.setHex(PLAYER_COLORS[unit.owner]);
        }
    }

    // ----------------------------------------------------------
    // getUnitIdAt — for click-picking via raycaster intersections
    // ----------------------------------------------------------

    getUnitIdFromMesh(mesh: THREE.Object3D): UnitID | null {
        return (mesh.userData?.unitId as UnitID) ?? null;
    }
}