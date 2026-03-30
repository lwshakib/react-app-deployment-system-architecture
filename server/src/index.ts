/**
 * Main Application Entry Point.
 * This file initializes the Express server, sets up middleware, 
 * defines API routes, and starts background workers for Kafka and SQS.
 */

import express from "express";
import cors from "cors";

// Import core services for background processing and messaging
import { kafkaService } from "./services/kafka.services";
import { sqsService } from "./services/sqs.services";

// Import centralized routing logic
import router from "./routes";

// Import specialized loggers and centralized error handling
import morganMiddleware from "./logger/morgan.logger";
import { errorHandler } from "./middlewares/error.middlewares";
import logger from "./logger/winston.logger";

// Import shared environment configuration
import { PORT } from "./envs";

const app = express();
const port = PORT;

// --- GLOBAL MIDDLEWARES ---
// Enable Cross-Origin Resource Sharing (required for separate frontend)
app.use(cors());
// Parse incoming JSON request bodies
app.use(express.json());
// Standard HTTP request logging using Morgan + Winston
app.use(morganMiddleware);

// --- API ROUTING ---
// All business logic routes are prefixed with /api
app.use("/api", router);

// --- ERROR HANDLING ---
// Global catch-all middleware for handling and formatting API errors
app.use(errorHandler);

// --- BACKGROUND WORKERS & CONSUMERS ---
/**
 * Kafka Log Consumer:
 * Listens for real-time build logs from containers and persists them to ClickHouse.
 */
kafkaService.initLogConsumer().catch((err) => logger.error("❌ Kafka Log Consumer Error:", err));

/**
 * Kafka Status Consumer:
 * Listens for deployment status updates (READY/FAILED) and updates the Postgres DB.
 */
kafkaService.initStatusConsumer().catch((err) => logger.error("❌ Kafka Status Consumer Error:", err));

/**
 * SQS Polling:
 * Continually polls AWS SQS for pending build tasks and triggers ECS deployments.
 */
sqsService.startPolling().catch((err) => logger.error("❌ SQS Polling Error:", err));

// Start listening for incoming HTTP requests
app.listen(port, () => logger.info(`\n✨ Server is glowing at http://localhost:${port}`));