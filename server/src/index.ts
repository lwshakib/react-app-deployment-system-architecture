import express from "express";
import cors from "cors";
import { Server } from "socket.io";
import { v4 as uuidv4 } from "uuid";
import { kafkaService } from "./services/kafka.service";
import { clickHouseService } from "./services/clickhouse.service";
import { postgresService } from "./services/postgres.service";
import { eventBus } from "./services/event-bus.service";
import { sqsService } from "./services/sqs.service";
import router from "./routes";

const app = express();
const port = process.env.PORT || 8000;
const socketPort = 9002;

// Middleware
app.use(cors());
app.use(express.json());

// API Router
app.use("/api", router);

// Socket.io (Legacy support for other features if any, but now secondary to SSE)
const io = new Server({ cors: { origin: "*" } });
io.listen(socketPort);

// Kafka Consumers
async function initKafkaLogConsumer() {
  await kafkaService.listenBatch("container-logs", "api-server-logs-consumer", async ({ batch, heartbeat, resolveOffset }: any) => {
    const logEntries = [];
    const validMessages = [];

    for (const message of batch.messages) {
      if (!message.value) continue;
      try {
        const data = JSON.parse(message.value.toString());
        logEntries.push({ event_id: uuidv4(), deployment_id: data.DEPLOYMENT_ID, log: data.log });
        eventBus.emit("log-received", data); // Bridge to SSE
        validMessages.push(message);
      } catch (err) {
        console.error("❌ Kafka Log Consumer: Error parsing JSON:", err, message.value.toString());
        // For malformed JSON, we resolve it to skip it, otherwise it blocks the queue
        resolveOffset(message.offset);
      }
    }

    if (logEntries.length > 0) {
      try {
        await clickHouseService.insert("log_events", logEntries);
        // ONLY resolve offsets after successful storage in ClickHouse
        for (const message of validMessages) {
          resolveOffset(message.offset);
        }
        console.log(`📝 Log Consumer: Batched ${logEntries.length} logs to ClickHouse.`);
      } catch (err) {
        console.error("❌ Kafka Log Consumer: ClickHouse Insertion Failed:", err);
        // We DON'T resolve offsets here, so Kafka will retry this batch later
        throw err;
      }
    }
    await heartbeat();
  });
}

async function initKafkaStatusConsumer() {
  await kafkaService.listenBatch("deployment-status", "api-server-status-consumer", async ({ batch, heartbeat, resolveOffset }: any) => {
    for (const message of batch.messages) {
      if (!message.value) continue;
      try {
        const payload = message.value.toString();
        const data = JSON.parse(payload);
        const { DEPLOYMENT_ID, status } = data;
        
        if (!status) {
            console.warn(`⚠️ Status Consumer: Received message without status for deployment ${DEPLOYMENT_ID}. Skipping DB update.`);
            resolveOffset(message.offset);
            continue;
        }

        const res = await postgresService.query("UPDATE deployments SET status = $1 WHERE id = $2", [status, DEPLOYMENT_ID]);
        eventBus.emit("deployment-status-changed"); // Bridge to SSE Dashboard
        
        if (res.rowCount === 0) {
          console.warn(`⚠️ Status Consumer: No deployment found with ID ${DEPLOYMENT_ID}`);
        } else {
          console.log(`🔔 Status Consumer: Updated deployment ${DEPLOYMENT_ID} to ${status}`);
        }
        resolveOffset(message.offset);
      } catch (err) {
        console.error("❌ Kafka Status Consumer Error:", err, message.value?.toString());
        if (err instanceof SyntaxError) {
          resolveOffset(message.offset);
        } else {
          throw err;
        }
      }
    }
    await heartbeat();
  });
}

initKafkaLogConsumer().catch(console.error);
initKafkaStatusConsumer().catch(console.error);
sqsService.startPolling().catch(console.error);

app.listen(port, () => console.log(`\n✨ Server is glowing at http://localhost:${port}`));