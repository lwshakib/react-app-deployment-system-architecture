import dotenv from "dotenv";
dotenv.config();

function getEnv(key: string, required = true, defaultValue?: string): string {
    const value = process.env[key];
    if (required && !value && defaultValue === undefined) {
        throw new Error(`❌ Missing required environment variable: ${key}`);
    }
    return value || defaultValue || "";
}

// Server Configuration
export const NODE_ENV = getEnv("NODE_ENV", false, "development");
export const PORT = parseInt(getEnv("PORT", false, "8000"), 10);
export const S3_REVERSE_PROXY_URL = getEnv("S3_REVERSE_PROXY_URL", false, "http://localhost:8080");

// AWS Configuration
export const AWS_REGION = getEnv("AWS_REGION");
export const AWS_ACCESS_KEY_ID = getEnv("AWS_ACCESS_KEY_ID");
export const AWS_SECRET_ACCESS_KEY = getEnv("AWS_SECRET_ACCESS_KEY");
export const AWS_SQS_QUEUE_URL = getEnv("AWS_SQS_QUEUE_URL");

// S3 Configuration
export const S3_BUCKET_NAME = getEnv("S3_BUCKET_NAME");

// PostgreSQL Configuration
export const DATABASE_URL = getEnv("DATABASE_URL", false);
export const POSTGRES_CA_CERT = getEnv("POSTGRES_CA_CERT", false);
export const DB_USER = getEnv("DB_USER", false);
export const DB_HOST = getEnv("DB_HOST", false);
export const DB_NAME = getEnv("DB_NAME", false);
export const DB_PASSWORD = getEnv("DB_PASSWORD", false);
export const DB_PORT = getEnv("DB_PORT", false);

// Kafka Configuration
export const KAFKA_BROKER = getEnv("KAFKA_BROKER");
export const KAFKA_USERNAME = getEnv("KAFKA_USERNAME");
export const KAFKA_PASSWORD = getEnv("KAFKA_PASSWORD");
export const KAFKA_CLIENT_ID = getEnv("KAFKA_CLIENT_ID", false, "server-client");
export const KAFKA_CA_CERT = getEnv("KAFKA_CA_CERT", false);

// ECS Configuration
export const ECS_CONTAINER_NAME = getEnv("ECS_CONTAINER_NAME");
export const ECS_CLUSTER_ARN = getEnv("ECS_CLUSTER_ARN");
export const ECS_TASK_DEFINITION_ARN = getEnv("ECS_TASK_DEFINITION_ARN");
export const ECS_SUBNETS = getEnv("ECS_SUBNETS");
export const ECS_SECURITY_GROUPS = getEnv("ECS_SECURITY_GROUPS");

// Clickhouse Configuration
export const CLICKHOUSE_URL = getEnv("CLICKHOUSE_URL");
export const CLICKHOUSE_USER = getEnv("CLICKHOUSE_USER");
export const CLICKHOUSE_PASSWORD = getEnv("CLICKHOUSE_PASSWORD");
export const CLICKHOUSE_DB = getEnv("CLICKHOUSE_DB");
