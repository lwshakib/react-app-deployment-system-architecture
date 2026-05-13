/**
 * Application-wide Event Bus.
 * A central EventEmitter used to facilitate communication between different 
 * parts of the server (e.g., notifying the SSE streams when Kafka consumers 
 * receive new logs or status updates).
 */

import { EventEmitter } from "events";

// Export a shared singleton instance of the EventEmitter
export const eventBus = new EventEmitter();

export default eventBus;
