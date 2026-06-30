// ============================================================
// FAE ENGINE — Layer 6: Renderer / Map
// Pure read of GameMap → Three.js meshes.
// No logic. No mutation of game state. Just drawing.
// ============================================================

import * as THREE from "three";
import type { GameMap, TerrainType, Coords } from "../../../src/state/types";

export const TILE_SIZE = 1.0;

// ------------------------------------------------------------
// Terrain colors — visual mapping only, lives entirely here
// ------------------------------------------------------------

const TERRAIN_COLORS: Record<TerrainType, number> = {
    plains: 0x4a7c3c,
    forest: 0x1f5c2e,
    hills: 0x8a7a5c,
    water: 0x2a5c8c,
    wall: 0x3a3a3a,
};

const TERRAIN_HEIGHT: Record<TerrainType, number> = {
    plains: 0.1,
    forest: 0.15,
    hills: 0.4,
    water: 0.02,
    wall: 0.6,
};

// ------------------------------------------------------------
// worldPosition
// Converts grid coords to Three.js world space.
// Centers the map around the origin for a balanced camera view.
// ------------------------------------------------------------

export function worldPosition(coords: Coords, map: GameMap): THREE.Vector3 {
    const offsetX = -(map.width - 1) / 2;
    const offsetZ = -(map.height - 1) / 2;
    return new THREE.Vector3(
        (coords.x + offsetX) * TILE_SIZE,
        0,
        (coords.y + offsetZ) * TILE_SIZE
    );
}

// ------------------------------------------------------------
// buildMapMesh
// Builds one mesh group representing the entire map.
// Each tile is a separate box so terrain height can vary.
// ------------------------------------------------------------

export function buildMapMesh(map: GameMap): THREE.Group {
    const group = new THREE.Group();
    group.name = "map";

    for (let y = 0; y < map.height; y++) {
        for (let x = 0; x < map.width; x++) {
            const tile = map.tiles[y]?.[x];
            if (!tile) continue;

            const height = TERRAIN_HEIGHT[tile.terrain];
            const geometry = new THREE.BoxGeometry(
                TILE_SIZE * 0.96,
                height,
                TILE_SIZE * 0.96
            );
            const material = new THREE.MeshStandardMaterial({
                color: TERRAIN_COLORS[tile.terrain],
            });
            const mesh = new THREE.Mesh(geometry, material);

            const pos = worldPosition({ x, y }, map);
            mesh.position.set(pos.x, height / 2, pos.z);
            mesh.receiveShadow = true;
            mesh.castShadow = tile.terrain !== "plains" && tile.terrain !== "water";

            mesh.userData = { type: "tile", coords: { x, y } };

            group.add(mesh);
        }
    }

    return group;
}