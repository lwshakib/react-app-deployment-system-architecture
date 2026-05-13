/**
 * Main API Router.
 * This module aggregates all sub-routers (deployments, logs) into a single
 * router instance that is used by the main Express application.
 */

import { Router } from "express";
import deploymentRouter from "./deployment.routes";
import logRouter from "./log.routes";

const router = Router();

// Register the deployment router under the '/deployments' path
router.use("/deployments", deploymentRouter);

// Register the log router under the '/logs' path
router.use("/logs", logRouter);

export default router;
