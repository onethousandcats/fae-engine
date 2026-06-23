// ============================================================
// FAE ENGINE — Layer 1: State Factories
// Pure functions that produce valid initial states.
// No mutation. No side effects.
// ============================================================

import type {
    GameState,
    GameMap,
    Tile,
    TerrainType,
    Unit,
    UnitID,
    UnitClass,
    UnitStats,
    Player,
    PlayerID,
    Coords,
    WinCondition,
} from "./types";

export const BASE_STATS: Record<UnitClass, UnitStats> = {
    infantry: { maxHp: 10, attack: 3, defense: 2, movement: 4, range: 1 },
    archer: { maxHp: 8, attack: 4, defense: 1, movement: 2, range: 3 },
    cavalry: { maxHp: 12, attack: 4, defense: 1, movement: 5, range: 1 },
    mage: { maxHp: 6, attack: 5, defense: 0, movement: 2, range: 3 },
};

const TERRAIN_PASSABLE: Record<TerrainType, boolean> = {
    plains: true,
    forest: true,
    hills: true,
    water: false,
    wall: false,
};

const TERRAIN_BLOCKS_LOS: Record<TerrainType, boolean> = {
    plains: false,
    forest: false,
    hills: true,
    water: false,
    wall: true,
};

// ------------------------------------------------------------
// Map factory
// ------------------------------------------------------------

export function createFlatMap(width: number, height: number): GameMap {
    const tiles: Tile[][] = [];
    for (let y = 0; y < height; y++) {
        const row: Tile[] = [];
        for (let x = 0; x < width; x++) {
            row.push(createTile({ x, y }, "plains"));
        }
        tiles.push(row);
    }
    return { width, height, tiles };
}

export function createTile(coords: Coords, terrain: TerrainType): Tile {
    return {
        coords,
        terrain,
        passable: TERRAIN_PASSABLE[terrain],
        blocksLOS: TERRAIN_BLOCKS_LOS[terrain],
    };
}

export function createMapFromString(layout: string): GameMap {
    const CHAR_MAP: Record<string, TerrainType> = {
        ".": "plains",
        "F": "forest",
        "H": "hills",
        "W": "water",
        "X": "wall",
    };

    const rows = layout
        .trim()
        .split("\n")
        .map((r) => r.trim().split(/\s+/));

    const height = rows.length;
    const width = rows[0]?.length ?? 0;

    const tiles: Tile[][] = rows.map((row, y) =>
        row.map((char, x) => {
            const terrain = CHAR_MAP[char] ?? "plains";
            return createTile({ x, y }, terrain);
        })
    );

    return { width, height, tiles };
}

// ------------------------------------------------------------
// Unit factory
// ------------------------------------------------------------

let _unitCounter = 0;

export function createUnit(
    owner: PlayerID,
    unitClass: UnitClass,
    coords: Coords,
    idOverride?: UnitID
): Unit {
    const id: UnitID = idOverride ?? `unit_${owner}_${_unitCounter++}`;
    const stats = BASE_STATS[unitClass];
    return {
        id,
        owner,
        class: unitClass,
        stats,
        hp: stats.maxHp,
        coords,
        status: "idle",
        hasMoved: false,
        hasActed: false,
    };
}

// ------------------------------------------------------------
// Player factory
// ------------------------------------------------------------

export function createPlayer(id: PlayerID, name: string, units: Unit[]): Player {
    return {
        id,
        name,
        resources: 0,
        unitIds: units.map((u) => u.id),
        isDefeated: false,
    };
}

// ------------------------------------------------------------
// Game state factory
// ------------------------------------------------------------

export type NewGameOptions = {
    map: GameMap;
    player0Name?: string;
    player1Name?: string;
    player0Units: Array<{ class: UnitClass; coords: Coords }>;
    player1Units: Array<{ class: UnitClass; coords: Coords }>;
    winCondition?: WinCondition;
};

export function createGameState(options: NewGameOptions): GameState {
    const {
        map,
        player0Name = "Player 1",
        player1Name = "Player 2",
        player0Units,
        player1Units,
        winCondition = "elimination",
    } = options;

    // reset counter for deterministic IDs per game
    _unitCounter = 0;

    const p0Units = player0Units.map(({ class: c, coords }) =>
        createUnit(0, c, coords)
    );
    const p1Units = player1Units.map(({ class: c, coords }) =>
        createUnit(1, c, coords)
    );

    const allUnits = [...p0Units, ...p1Units];
    const unitsRecord = Object.fromEntries(allUnits.map((u) => [u.id, u] as const)) as Record<UnitID, Unit>;

    const player0 = createPlayer(0, player0Name, p0Units);
    const player1 = createPlayer(1, player1Name, p1Units);

    return {
        id: `game_${Date.now()}`,
        map,
        units: unitsRecord,
        players: { 0: player0, 1: player1 },
        turn: 1,
        activePlayer: 0,
        phase: "player_phase",
        winCondition,
        victoryState: { status: "ongoing" },
        history: [],
    };
}