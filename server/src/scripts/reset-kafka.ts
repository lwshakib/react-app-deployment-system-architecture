import { kafkaService } from "../services/kafka.service";

async function resetKafka() {
  console.log("🔥 Resetting Kafka topics...");

  const TOPIC = "container-logs";

  try {
    const admin = await kafkaService.getAdmin();
    const existingTopics = await admin.listTopics();
    if (existingTopics.includes(TOPIC)) {
      await admin.deleteTopics({ topics: [TOPIC] });
      console.log(`✅ Kafka topic '${TOPIC}' deleted successfully.`);
    } else {
      console.log(`ℹ️ Topic '${TOPIC}' does not exist, skipping.`);
    }
  } catch (error) {
    console.error("❌ Kafka reset failed:", error);
    process.exit(1);
  } finally {
    await kafkaService.disconnect();
  }
}

resetKafka();
