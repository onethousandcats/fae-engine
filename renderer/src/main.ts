// ============================================================
// FAE ENGINE — Layer 6: Main
// This is the ONLY file that knows about both the engine
// and the renderer. Everything else stays on one side of
// the boundary. This is the game loop.
// ============================================================

import "./style.css";
import type { GameState } from "../../src/state/types";
import type { GameAction } from "../../src/actions/types";
import { createGameState, createMapFromString } from "../../src/state/factory";
import { applyWithEvents } from "../../src/events/bridge";
import { EventEmitter } from "../../src/events/emitter";
import { endTurnAction } from "../../src/actions/types";
import { validate } from "../../src/actions/validate";
import { chooseBestAction } from "../../src/ai/minimax";

import { createScene, startRenderLoop } from "./renderer/scene";
import { buildMapMesh } from "./renderer/map";
import { UnitRenderer } from "./renderer/units";
import { HighlightRenderer } from "./renderer/highlights";
import {
  createSelectionState,
  screenToGridCoords,
  handleClick,
} from "./renderer/input";

// ------------------------------------------------------------
// Game setup
// ------------------------------------------------------------

const map = createMapFromString(`
  . . . F F . . .
  . . . F F . . .
  . . H . . . . .
  . . . . . . H .
  . H . . . . . .
  . . . . . H . .
  . . F F . . . .
  . . F F . . . .
`);

let state: GameState = createGameState({
  map,
  player0Name: "Blue",
  player1Name: "Red",
  player0Units: [
    { class: "infantry", coords: { x: 0, y: 0 } },
    { class: "archer", coords: { x: 1, y: 0 } },
    { class: "cavalry", coords: { x: 0, y: 1 } },
  ],
  player1Units: [
    { class: "infantry", coords: { x: 7, y: 7 } },
    { class: "archer", coords: { x: 6, y: 7 } },
    { class: "mage", coords: { x: 7, y: 6 } },
  ],
});

const emitter = new EventEmitter();
const selection = createSelectionState();

// AI controls player 1
const AI_PLAYER = 1;
const AI_DEPTH = 2;

// ------------------------------------------------------------
// Renderer setup
// ------------------------------------------------------------

const container = document.getElementById("app")!;
const ctx = createScene(container);

ctx.scene.add(buildMapMesh(state.map));

const unitRenderer = new UnitRenderer(state.map);
ctx.scene.add(unitRenderer.getGroup());

const highlightRenderer = new HighlightRenderer();
ctx.scene.add(highlightRenderer.getGroup());

// ------------------------------------------------------------
// UI overlay — turn indicator and end turn button
// ------------------------------------------------------------

const hud = document.createElement("div");
hud.className = "hud";
document.body.appendChild(hud);

function renderHud(): void {
  const player = state.players[state.activePlayer];
  const statusText =
    state.victoryState.status === "victory"
      ? `${state.players[state.victoryState.winner].name} wins!`
      : state.victoryState.status === "draw"
        ? "Draw!"
        : `${player.name}'s turn (Turn ${state.turn})`;

  hud.innerHTML = `
    <div class="hud-status">${statusText}</div>
    ${state.victoryState.status === "ongoing" && state.activePlayer !== AI_PLAYER
      ? `<button id="end-turn-btn">End Turn</button>`
      : ""
    }
  `;

  const btn = document.getElementById("end-turn-btn");
  btn?.addEventListener("click", () => {
    commitAction(endTurnAction(state.activePlayer));
  });
}

// ------------------------------------------------------------
// commitAction — the ONLY place that mutates `state`
// Validates, applies, derives events, emits, re-syncs renderer
// ------------------------------------------------------------

function commitAction(action: GameAction): void {
  const result = validate(state, action);
  if (!result.valid) {
    console.warn("Rejected action:", action.type, result.reason);
    return;
  }

  const [next, events] = applyWithEvents(state, action);
  state = next;
  emitter.emitAll(events);

  selection.selectedUnitId = null;
  syncRenderer();
  renderHud();

  maybeRunAI();
}

// ------------------------------------------------------------
// AI turn handling
// ------------------------------------------------------------

function maybeRunAI(): void {
  if (state.activePlayer !== AI_PLAYER) return;
  if (state.victoryState.status !== "ongoing") return;

  // Small delay so AI moves feel readable rather than instant
  setTimeout(() => {
    const result = chooseBestAction(state, AI_DEPTH);
    if (result.action) {
      commitAction(result.action);
    }
  }, 500);
}

// ------------------------------------------------------------
// syncRenderer — pure read of state into visuals
// ------------------------------------------------------------

function syncRenderer(): void {
  unitRenderer.sync(state.units);
  highlightRenderer.show(state, selection.selectedUnitId);
}

// ------------------------------------------------------------
// Input wiring
// ------------------------------------------------------------

ctx.renderer.domElement.addEventListener("click", (event) => {
  if (state.activePlayer === AI_PLAYER) return; // ignore clicks during AI turn
  if (state.victoryState.status !== "ongoing") return;

  const coords = screenToGridCoords(event, ctx, state);
  if (!coords) return;

  const intent = handleClick(state, selection, coords);
  if (!intent) return;

  switch (intent.type) {
    case "select":
      selection.selectedUnitId = intent.unitId;
      syncRenderer();
      break;
    case "clear":
      selection.selectedUnitId = null;
      syncRenderer();
      break;
    case "action":
      commitAction(intent.action);
      break;
  }
});

// ------------------------------------------------------------
// Event log — demonstrates the event system wired to the UI
// ------------------------------------------------------------

const log = document.createElement("div");
log.className = "event-log";
document.body.appendChild(log);

function logLine(text: string): void {
  const line = document.createElement("div");
  line.textContent = text;
  log.prepend(line);
  while (log.children.length > 6) {
    log.removeChild(log.lastChild!);
  }
}

emitter.on("UNIT_MOVED", (e) => logLine(`Unit moved to (${e.to.x}, ${e.to.y})`));
emitter.on("UNIT_ATTACKED", (e) => logLine(`Attack! ${e.damage} damage dealt`));
emitter.on("UNIT_DEFEATED", () => logLine(`A unit was defeated`));
emitter.on("TURN_STARTED", (e) => logLine(`Turn ${e.turn} — Player ${e.playerId}'s turn`));
emitter.on("GAME_OVER", (e) =>
  logLine(e.winner !== null ? `Game over — Player ${e.winner} wins!` : "Game over — draw!")
);

// ------------------------------------------------------------
// Start
// ------------------------------------------------------------

syncRenderer();
renderHud();
startRenderLoop(ctx);