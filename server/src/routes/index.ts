import { Router } from "express";
import deploymentRouter from "./deployment.routes";
import logRouter from "./log.routes";

const router = Router();

router.use("/deployments", deploymentRouter);
router.use("/logs", logRouter);

export default router;
