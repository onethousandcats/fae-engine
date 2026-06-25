// ============================================================
// FAE ENGINE — Layer 3: Event Emitter
// Lightweight pub/sub layered on top of state transitions.
// Handlers are side effects only — they never mutate state.
// ============================================================

import type { GameEvent, GameEventType, EventHandler } from "./types";

// ------------------------------------------------------------
// EventEmitter
// ------------------------------------------------------------

export class EventEmitter {
    private handlers: Map<GameEventType, Set<EventHandler<GameEvent>>>;
    private queue: GameEvent[];
    private isDispatching: boolean;

    constructor() {
        this.handlers = new Map();
        this.queue = [];
        this.isDispatching = false;
    }

    // ----------------------------------------------------------
    // on — subscribe to an event type
    // Returns an unsubscribe function for clean teardown
    // ----------------------------------------------------------

    on<T extends GameEventType>(
        type: T,
        handler: EventHandler<Extract<GameEvent, { type: T }>>
    ): () => void {
        if (!this.handlers.has(type)) {
            this.handlers.set(type, new Set());
        }
        // Cast is safe: handler is typed to the specific event shape
        this.handlers.get(type)!.add(handler as EventHandler<GameEvent>);

        return () => this.off(type, handler as EventHandler<GameEvent>);
    }

    // ----------------------------------------------------------
    // off — unsubscribe a specific handler
    // ----------------------------------------------------------

    off(type: GameEventType, handler: EventHandler<GameEvent>): void {
        this.handlers.get(type)?.delete(handler);
    }

    // ----------------------------------------------------------
    // emit — queue an event for dispatch
    // Queuing rather than immediate dispatch prevents handlers
    // from firing mid-transition and avoids re-entrancy bugs.
    // ----------------------------------------------------------

    emit(event: GameEvent): void {
        this.queue.push(event);
        if (!this.isDispatching) {
            this.flush();
        }
    }

    // ----------------------------------------------------------
    // emitAll — queue multiple events in order
    // ----------------------------------------------------------

    emitAll(events: GameEvent[]): void {
        for (const event of events) {
            this.queue.push(event);
        }
        if (!this.isDispatching) {
            this.flush();
        }
    }

    // ----------------------------------------------------------
    // flush — dispatch all queued events in order
    // ----------------------------------------------------------

    private flush(): void {
        this.isDispatching = true;
        while (this.queue.length > 0) {
            const event = this.queue.shift();
            if (event) {
                this.dispatch(event);
            }
        }
        this.isDispatching = false;
    }

    // ----------------------------------------------------------
    // dispatch — call all handlers for a given event
    // ----------------------------------------------------------

    private dispatch(event: GameEvent): void {
        const handlers = this.handlers.get(event.type);
        if (!handlers) return;
        for (const handler of handlers) {
            handler(event);
        }
    }

    // ----------------------------------------------------------
    // clear — remove all handlers (useful for cleanup/testing)
    // ----------------------------------------------------------

    clear(type?: GameEventType): void {
        if (type) {
            this.handlers.delete(type);
        } else {
            this.handlers.clear();
        }
    }

    // ----------------------------------------------------------
    // listenerCount — useful for debugging
    // ----------------------------------------------------------

    listenerCount(type: GameEventType): number {
        return this.handlers.get(type)?.size ?? 0;
    }
}