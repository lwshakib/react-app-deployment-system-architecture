/**
 * Log Controller.
 * Handles the retrieval of build logs for specific deployments.
 * Supports both standard HTTP polling (from ClickHouse) and real-time 
 * streaming via Server-Sent Events (SSE).
 */

import { Request, Response } from "express";
import { clickHouseService } from "../services/clickhouse.services";
import { eventBus } from "../services/event-bus.services";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiResponse } from "../utils/ApiResponse";
import logger from "../logger/winston.logger";

/**
 * Fetches historical logs from ClickHouse for a specific deployment.
 * Used when the user first loads the deployment detail page.
 */
export const getLogs = asyncHandler(async (req: Request, res: Response) => {
  // Query ClickHouse using parameterized query for security
  const logs = await clickHouseService.query(
    "SELECT event_id, log, timestamp from log_events where deployment_id = {deployment_id:String}",
    { deployment_id: req.params.id }
  );
  
  return res.status(200).json(new ApiResponse(200, { logs }, "Logs fetched successfully"));
});

/**
 * Server-Sent Events (SSE) Stream for Live Logs.
 * Pushes new logs to the browser as they arrive from Kafka producers (build containers).
 */
export const logStream = (req: Request, res: Response) => {
  const deploymentId = req.params.id;
  
  // Initialize SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  logger.info(`🔌 New Log SSE Client connected for ${deploymentId}`);

  /**
   * Local handler function to filter and send logs for THIS specific deployment.
   * Runs when the Kafka Service emits a 'log-received' event.
   */
  const logHandler = (data: { DEPLOYMENT_ID: string; log: string }) => {
    // Only send the log if it belongs to the deployment the user is currently viewing
    if (data.DEPLOYMENT_ID === deploymentId) {
      // Standard message format: 'data: <json>\n\n'
      res.write(`data: ${JSON.stringify({ log: data.log })}\n\n`);
    }
  };

  // Subscribe to the global event bus
  eventBus.on("log-received", logHandler);

  // Clean up the subscription when the user leaves the page or closes the browser
  req.on("close", () => {
    eventBus.off("log-received", logHandler);
    logger.info(`🔌 Log SSE Client disconnected for ${deploymentId}`);
  });
};
