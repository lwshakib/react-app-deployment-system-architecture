/**
 * Log Routes.
 * Defines endpoints for accessing historical and real-time build logs.
 */

import { Router } from "express";
import * as logController from "../controllers/log.controller";

const router = Router();

// Real-time log streaming for a specific deployment via SSE
router.get("/:id/stream", logController.logStream);

// Retrieval of all historical logs for a specific deployment from ClickHouse
router.get("/:id", logController.getLogs);

export default router;
