import { kafkaService } from "../services/kafka.service";

async function resetKafka() {
  console.log("🔥 Resetting Kafka topics...");

  const TOPICS = ["container-logs", "deployment-status"];

  try {
    const admin = await kafkaService.getAdmin();
    const existingTopics = await admin.listTopics();
    
    for (const topic of TOPICS) {
      if (existingTopics.includes(topic)) {
        await admin.deleteTopics({ topics: [topic] });
        console.log(`✅ Kafka topic '${topic}' deleted successfully.`);
      } else {
        console.log(`ℹ️ Topic '${topic}' does not exist, skipping.`);
      }
    }
  } catch (error) {
    console.error("❌ Kafka reset failed:", error);
    process.exit(1);
  } finally {
    await kafkaService.disconnect();
  }
}

resetKafka();
