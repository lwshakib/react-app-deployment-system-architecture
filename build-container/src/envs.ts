import dotenv from "dotenv";
dotenv.config();

function getEnv(key: string, required = true): string {
    const value = process.env[key];
    if (required && !value) {
        throw new Error(`❌ Missing required environment variable: ${key}`);
    }
    return value || "";
}

export const PROJECT_ID = getEnv("PROJECT_ID");
export const PROJECT_NAME = getEnv("PROJECT_NAME", false) || PROJECT_ID;
export const DEPLOYMENT_ID = getEnv("DEPLOYMENT_ID");

export const GIT_REPOSITORY__URL = getEnv("GIT_REPOSITORY__URL");

export const KAFKA_BROKER = getEnv("KAFKA_BROKER");
export const KAFKA_CA_CERT = getEnv("KAFKA_CA_CERT", false);
export const KAFKA_USERNAME = getEnv("KAFKA_USERNAME");
export const KAFKA_PASSWORD = getEnv("KAFKA_PASSWORD");

export const S3_BUCKET_NAME = getEnv("S3_BUCKET_NAME");
export const AWS_REGION = getEnv("AWS_REGION");
export const AWS_ACCESS_KEY_ID = getEnv("AWS_ACCESS_KEY_ID");
export const AWS_SECRET_ACCESS_KEY = getEnv("AWS_SECRET_ACCESS_KEY");
