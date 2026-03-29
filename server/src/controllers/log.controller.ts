import { Request, Response } from "express";
import { clickHouseService } from "../services/clickhouse.services";
import { eventBus } from "../services/event-bus.services";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiResponse } from "../utils/ApiResponse";
import logger from "../logger/winston.logger";

export const getLogs = asyncHandler(async (req: Request, res: Response) => {
  const logs = await clickHouseService.query(
    "SELECT event_id, log, timestamp from log_events where deployment_id = {deployment_id:String}",
    { deployment_id: req.params.id }
  );
  
  return res.status(200).json(new ApiResponse(200, { logs }, "Logs fetched successfully"));
});

export const logStream = (req: Request, res: Response) => {
  const deploymentId = req.params.id;
  
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  logger.info(`🔌 New Log SSE Client connected for ${deploymentId}`);

  const logHandler = (data: { DEPLOYMENT_ID: string; log: string }) => {
    if (data.DEPLOYMENT_ID === deploymentId) {
      res.write(`data: ${JSON.stringify({ log: data.log })}\n\n`);
    }
  };

  eventBus.on("log-received", logHandler);

  req.on("close", () => {
    eventBus.off("log-received", logHandler);
    logger.info(`🔌 Log SSE Client disconnected for ${deploymentId}`);
  });
};
