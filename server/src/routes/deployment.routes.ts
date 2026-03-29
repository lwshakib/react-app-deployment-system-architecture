import { Router } from "express";
import * as deploymentController from "../controllers/deployment.controller";

const router = Router();

router.get("/stream", deploymentController.dashboardStream);
router.get("/projects/:id", deploymentController.getProjectById);
router.get("/", deploymentController.getDeployments);
router.get("/:id", deploymentController.getDeploymentById);
router.post("/", deploymentController.createDeployment);
router.post("/projects/:projectId/deployments", deploymentController.createDeployment);
router.delete("/:id", deploymentController.deleteDeployment);
router.get("/:id/files", deploymentController.getDeploymentFiles);

export default router;
