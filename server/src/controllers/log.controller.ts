import { Request, Response } from "express";
import { clickHouseService } from "../services/clickhouse.service";
import { eventBus } from "../services/event-bus.service";

export const getLogs = async (req: Request, res: Response) => {
  try {
    const logs = await clickHouseService.query(
      "SELECT event_id, log, timestamp from log_events where deployment_id = {deployment_id:String}",
      { deployment_id: req.params.id }
    );
    res.json({ logs });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch logs" });
  }
};

export const logStream = (req: Request, res: Response) => {
  const deploymentId = req.params.id;
  
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  console.log(`🔌 New Log SSE Client connected for ${deploymentId}`);

  const logHandler = (data: { DEPLOYMENT_ID: string; log: string }) => {
    if (data.DEPLOYMENT_ID === deploymentId) {
      res.write(`data: ${JSON.stringify({ log: data.log })}\n\n`);
    }
  };

  eventBus.on("log-received", logHandler);

  req.on("close", () => {
    eventBus.off("log-received", logHandler);
    console.log(`🔌 Log SSE Client disconnected for ${deploymentId}`);
  });
};
