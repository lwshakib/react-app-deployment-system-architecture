import { Router } from "express";
import * as logController from "../controllers/log.controller";

const router = Router();

router.get("/:id/stream", logController.logStream);
router.get("/:id", logController.getLogs);

export default router;
