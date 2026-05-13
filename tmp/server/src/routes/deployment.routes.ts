/**
 * Deployment Routes.
 * Defines the HTTP endpoints for managing projects and their deployments.
 */

import { Router } from "express";
import * as deploymentController from "../controllers/deployment.controller";

const router = Router();

// SSE Stream for real-time dashboard updates
router.get("/stream", deploymentController.dashboardStream);

// Fetch project-specific metadata
router.get("/projects/:id", deploymentController.getProjectById);

// List all deployments (optionally filtered by project)
router.get("/", deploymentController.getDeployments);

// Fetch details for a specific deployment
router.get("/:id", deploymentController.getDeploymentById);

// Trigger a new deployment (project-less or body-provided project)
router.post("/", deploymentController.createDeployment);

// Trigger a new deployment for a specific project via URL parameter
router.post("/projects/:projectId/deployments", deploymentController.createDeployment);

// Delete a specific deployment and its build artifacts
router.delete("/:id", deploymentController.deleteDeployment);

// List all successfully generated files for a deployment
router.get("/:id/files", deploymentController.getDeploymentFiles);

export default router;
