/**
 * Environment configuration module.
 * This file handles loading and validating environment variables required 
 * for the build container to interact with Kafka, AWS S3, and Git.
 */

import dotenv from "dotenv";

// Load environment variables from a .env file into process.env
dotenv.config();

/**
 * Helper function to retrieve an environment variable.
 * Throws an error if a required variable is missing.
 * @param key - The name of the environment variable (e.g., "PROJECT_ID")
 * @param required - Whether the variable is mandatory (default: true)
 * @returns The value of the environment variable or an empty string
 */
function getEnv(key: string, required = true): string {
    const value = process.env[key];
    if (required && !value) {
        // If the variable is required but not found, stop the process early with an error
        throw new Error(`❌ Missing required environment variable: ${key}`);
    }
    return value || "";
}

// --- PROJECT & DEPLOYMENT METADATA ---
// Unique identifier for the project
export const PROJECT_ID = getEnv("PROJECT_ID");
// Human-readable name (falls back to PROJECT_ID if not set)
export const PROJECT_NAME = getEnv("PROJECT_NAME", false) || PROJECT_ID;
// Unique identifier for the specific deployment run
export const DEPLOYMENT_ID = getEnv("DEPLOYMENT_ID");

// --- GIT CONFIGURATION ---
// The URL of the repository to be cloned and built (e.g., GitHub, GitLab)
export const GIT_REPOSITORY__URL = getEnv("GIT_REPOSITORY__URL");

// --- KAFKA CONFIGURATION ---
// Kafka broker address (e.g., "pkc-abcde.us-east-1.aws.confluent.cloud:9092")
export const KAFKA_BROKER = getEnv("KAFKA_BROKER");
// Optional CA certificate for secure Kafka connection via SSL/TLS
export const KAFKA_CA_CERT = getEnv("KAFKA_CA_CERT", false);
// SASL credentials for Kafka authentication
export const KAFKA_USERNAME = getEnv("KAFKA_USERNAME");
export const KAFKA_PASSWORD = getEnv("KAFKA_PASSWORD");

// --- AWS S3 CONFIGURATION ---
// Destination bucket for storing build artifacts
export const S3_BUCKET_NAME = getEnv("S3_BUCKET_NAME");
// AWS region (e.g., "us-east-1")
export const AWS_REGION = getEnv("AWS_REGION");
// AWS IAM credentials for S3 access
export const AWS_ACCESS_KEY_ID = getEnv("AWS_ACCESS_KEY_ID");
export const AWS_SECRET_ACCESS_KEY = getEnv("AWS_SECRET_ACCESS_KEY");
