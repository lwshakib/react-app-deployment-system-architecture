/**
 * Environment configuration for the S3 Reverse Proxy.
 * This module loads and validates environment variables necessary for the 
 * server to interact with AWS S3 and the PostgreSQL database.
 */

import dotenv from "dotenv";

// Load environment variables from .env file into process.env
dotenv.config();

/**
 * Helper function to retrieve an environment variable.
 * @param key - The name of the environment variable
 * @param required - Whether the variable must be present (default: true)
 * @param defaultValue - Optional default value if not found
 * @returns The value of the environment variable or default
 * @throws Error if required variable is missing and no default is provided
 */
function getEnv(key: string, required = true, defaultValue?: string): string {
    const value = process.env[key];
    if (required && !value && defaultValue === undefined) {
        // Halt process if a critical configuration is missing
        throw new Error(`❌ Missing required environment variable: ${key}`);
    }
    return value || defaultValue || "";
}

// --- SERVER CONFIGURATION ---
// Environment mode (e.g., development, production)
export const NODE_ENV = getEnv("NODE_ENV", false, "development");
// Port on which the reverse proxy will listen (default: 9000)
export const PORT = parseInt(getEnv("PORT", false, "9000"), 10);

// --- AWS S3 CONFIGURATION ---
// S3 bucket where built project files are stored
export const S3_BUCKET_NAME = getEnv("S3_BUCKET_NAME");
// AWS region where the bucket is located
export const AWS_REGION = getEnv("AWS_REGION", false, "ap-south-1");

// --- DATABASE CONFIGURATION ---
// Option 1: Full database connection string (URL)
export const DATABASE_URL = getEnv("DATABASE_URL", false);
// SSL/TLS certificate for secure PostgreSQL connection
export const POSTGRES_CA_CERT = getEnv("POSTGRES_CA_CERT", false);

// Option 2: Individual database connection parameters
export const DB_USER = getEnv("DB_USER", false);
export const DB_HOST = getEnv("DB_HOST", false);
export const DB_NAME = getEnv("DB_NAME", false);
export const DB_PASSWORD = getEnv("DB_PASSWORD", false);
export const DB_PORT = getEnv("DB_PORT", false);
