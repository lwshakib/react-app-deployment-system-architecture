import dotenv from "dotenv";
dotenv.config();

function getEnv(key: string, required = true, defaultValue?: string): string {
    const value = process.env[key];
    if (required && !value && defaultValue === undefined) {
        throw new Error(`❌ Missing required environment variable: ${key}`);
    }
    return value || defaultValue || "";
}

export const NODE_ENV = getEnv("NODE_ENV", false, "development");
export const PORT = parseInt(getEnv("PORT", false, "9000"), 10);

export const S3_BUCKET_NAME = getEnv("S3_BUCKET_NAME");
export const AWS_REGION = getEnv("AWS_REGION", false, "ap-south-1");

export const DATABASE_URL = getEnv("DATABASE_URL", false);
export const POSTGRES_CA_CERT = getEnv("POSTGRES_CA_CERT", false);
export const DB_USER = getEnv("DB_USER", false);
export const DB_HOST = getEnv("DB_HOST", false);
export const DB_NAME = getEnv("DB_NAME", false);
export const DB_PASSWORD = getEnv("DB_PASSWORD", false);
export const DB_PORT = getEnv("DB_PORT", false);
