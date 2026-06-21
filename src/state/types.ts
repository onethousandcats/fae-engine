// ============================================================
// FAE ENGINE — Layer 1: Game State
// Pure serializable data model. No logic. No methods.
// Everything the engine reads from and writes to.
// ============================================================

// ------------------------------------------------------------
// Primitives
// ------------------------------------------------------------

export type PlayerID = 0 | 1

export type Coords = {
    readonly x: number;
    readonly y: number;
}

// ------------------------------------------------------------
// Map / Grid
// ------------------------------------------------------------

export type TerrainType =
    | "plains" // no mod
    | "forest" // +1 defense, +1 movement cost
    | "hills"  // +2 defense, +2 movement cost, blocks line of sight
    | "water"  // impassable except for certain units
    | "wall";  // impassable

export type Tile = {
    readonly coords: Coords;
    readonly terrain: TerrainType;
    readonly passable: boolean;
    readonly blocksLOS: boolean;
};

export type GameMap = {
    readonly width: number;
    readonly height: number;
    readonly tiles: ReadonlyArray<ReadonlyArray<Tile>>;
};

// ------------------------------------------------------------
// Units
// ------------------------------------------------------------

export type UnitID = string; // e.g. "unit_0_1" (player 0 unit 1)

export type UnitClass =
    | "infantry" // basic melee unit
    | "archer"   // ranged unit, can't attack adjacent targets
    | "cavalry"  // fast melee unit, weak defense
    | "mage";     // powerful ranged unit, can't attack adjacent targets, weak defense

export type UnitStats = {
    readonly maxHp: number;
    readonly attack: number;
    readonly defense: number;
    readonly movement: number;
    readonly range: number;
};

export type UnitStatus =
    | "idle"
    | "moved"
    | "acted"
    | "stunned"
    | "defeated";

export type Unit = {
    readonly id: UnitID;
    readonly owner: PlayerID;
    readonly class: UnitClass;
    readonly stats: UnitStats;
    readonly hp: number;
    readonly coords: Coords;
    readonly status: UnitStatus;
    readonly hasMoved: boolean;
    readonly hasActed: boolean;
};

// ------------------------------------------------------------
// Players
// ------------------------------------------------------------

export type Player = {
    readonly id: PlayerID;
    readonly name: string;
    readonly resources: number; // currency
    readonly unitIds: ReadonlyArray<UnitID>;
    readonly isDefeated: boolean;
}

// ------------------------------------------------------------
// Turn Structure
// ------------------------------------------------------------

export type TurnPhase =
    | "start_turn"
    | "player_phase"
    | "unit_phase"
    | "end_turn"
    | "game_over";

// ------------------------------------------------------------
// Win Conditions
// ------------------------------------------------------------

export type WinCondition =
    | "elimination" // defeat all opponent units
    | "capture";    // capture a specific tile (e.g. "base") and hold it for a turn

export type VictoryState =
    | { status: "ongoing" }
    | { status: "victory"; winner: PlayerID }
    | { status: "draw" };

// ------------------------------------------------------------
// Root Game State
// ------------------------------------------------------------

export type GameState = {
    // identity
    readonly id: string; // unique game ID

    // map
    readonly map: GameMap;

    // units
    readonly units: Readonly<Record<UnitID, Unit>>;

    // players
    readonly players: Readonly<Record<PlayerID, Player>>;

    // turn tracking
    readonly turn: number; // current turn number
    readonly activePlayer: PlayerID; // whose turn it is
    readonly phase: TurnPhase;

    // win conditions
    readonly winCondition: WinCondition;
    readonly victoryState: VictoryState;

    // action log -- append-only, for replay
    readonly history: ReadonlyArray<string>; // action IDs in order applied
};