import express from "express";
import cors from "cors";
import { kafkaService } from "./services/kafka.services";
import { sqsService } from "./services/sqs.services";
import router from "./routes";
import morganMiddleware from "./logger/morgan.logger";
import { errorHandler } from "./middlewares/error.middlewares";
import logger from "./logger/winston.logger";

const app = express();
const port = process.env.PORT || 8000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(morganMiddleware);

// API Router
app.use("/api", router);

// Global Error Handler
app.use(errorHandler);

// Kafka Consumers & SQS Polling
kafkaService.initLogConsumer().catch((err) => logger.error("❌ Kafka Log Consumer Error:", err));
kafkaService.initStatusConsumer().catch((err) => logger.error("❌ Kafka Status Consumer Error:", err));
sqsService.startPolling().catch((err) => logger.error("❌ SQS Polling Error:", err));

app.listen(port, () => logger.info(`\n✨ Server is glowing at http://localhost:${port}`));