/**
 * S3 Reverse Proxy Server.
 * This server intercept requests containing project-specific subdomains and 
 * redirects them to the corresponding build artifacts stored in Amazon S3.
 * 
 * Supports two routing modes:
 * 1. Specific Deployment: <deployment-uuid>.localhost
 * 2. Main Project: <project-subdomain>.localhost (routes to latest successful build)
 */

import express from 'express';
import httpProxy from 'http-proxy';
import { ServerResponse } from 'http';

// Logging and middleware imports
import logger from './logger/winston.logger.js';
import morganMiddleware from './logger/morgan.logger.js';
import { errorHandler } from './middlewares/error.middlewares.js';
import { ApiError } from './utils/ApiError.js';

// Environment configuration
import { AWS_REGION, PORT, S3_BUCKET_NAME } from './envs.js';

const app = express();

// Validate critical configuration on startup
if (!S3_BUCKET_NAME) {
    logger.error('❌ S3_BUCKET_NAME is not defined in .env');
    process.exit(1);
}

// Database service for project and deployment lookups
import { postgresService } from './services/postgres.services.js';

// Apply HTTP request logging middleware
app.use(morganMiddleware);

// Base S3 endpoint for the configured bucket
const S3_BASE_HOST = `https://${S3_BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com`;

/**
 * Initialize the proxy server.
 * target: The S3 base URL
 * changeOrigin: Required for S3 to see the correct Host header
 * secure: Set to false if using self-signed certificates (safe for internal proxying)
 */
const proxy = httpProxy.createProxyServer({
    target: S3_BASE_HOST,
    changeOrigin: true,
    secure: false,
});

// UUID Regex to detect if a subdomain is a specific deployment ID
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Main Routing Middleware.
 * Analyzes the Host header to determine which project and deployment to serve.
 */
app.use(async (req, res, next) => {
    const host = req.headers.host || '';
    // Extract the subdomain (e.g., 'myapp' from 'myapp.localhost')
    const subdomain = host.split('.')[0] || '';
    // Normalize the URL path (fallback to index.html for root requests)
    const urlPath = req.url === '/' ? '/index.html' : req.url;

    if (!subdomain) return next(new ApiError(400, "Invalid host."));

    let projectId = '';
    let deploymentId = '';

    // MODE 1: Directly requesting a specific deployment via its UUID
    if (UUID_REGEX.test(subdomain)) {
        deploymentId = subdomain;
        try {
            // Verify the deployment exists and fetch its project ID
            const result = await postgresService.query(
                'SELECT p.id FROM projects p JOIN deployments d ON p.id = d.project_id WHERE d.id = $1',
                [deploymentId]
            );
            if (result.rowCount === 0) return next(new ApiError(404, "Deployment not found."));
            const row = result.rows[0];
            if (row && typeof row.id === 'string') {
                projectId = row.id;
            } else {
                return next(new ApiError(500, "Internal error: Project ID not found."));
            }
        } catch (err) {
            return next(err);
        }
    } 
    // MODE 2: Requesting the main project subdomain
    else {
        try {
            // Find the latest 'READY' deployment for this project subdomain
            const result = await postgresService.query(
                `SELECT d.id, p.id as project_id FROM deployments d 
                 JOIN projects p ON d.project_id = p.id 
                 WHERE p.sub_domain = $1 AND d.status = 'READY' 
                 ORDER BY d.created_at DESC LIMIT 1`,
                [subdomain]
            );
            if (result.rowCount === 0) return next(new ApiError(404, "No successful deployment found for this project."));
            const row = result.rows[0];
            if (row && typeof row.id === 'string') {
                deploymentId = row.id;
                projectId = row.project_id;
            } else {
                return next(new ApiError(500, "Internal error: Deployment ID not found."));
            }
        } catch (err) {
            return next(err);
        }
    }

    // Rewrite the request URL to point to the S3 folder structure:
    // /__outputs/<project-id>/<deployment-id>/<file-path>
    const newPath = `/__outputs/${projectId}/${deploymentId}${urlPath}`;
    logger.info(`📡 Routing: ${host}${req.url} -> Folder: ${newPath}`);
    
    // Update the request URL before passing it to the proxy
    req.url = newPath;

    // Hand over the request to the proxy server to fetch from S3
    return proxy.web(req, res, {}, (err: any) => {
        logger.error(`❌ Proxy Callback Error: ${err.message}`);
        next(new ApiError(502, `Proxy error: Connection to S3 failed. ${err.message}`));
    });
});

/**
 * Cleanup headers before sending to S3.
 * S3 expects the Host header to match its actual endpoint.
 */
proxy.on('proxyReq', (proxyReq) => {
    proxyReq.setHeader('Host', `${S3_BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com`);
});

/**
 * Handle errors that occur during the proxying process.
 */
proxy.on('error', (err, req, res) => {
    logger.error(`❌ Proxy Instance Error: ${err.message}`);
    
    // If the response is an standard HTTP response and headers haven't been sent yet
    if (res instanceof ServerResponse) {
        if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
        }
        res.end(JSON.stringify({
            success: false,
            message: "Deployment Proxy Error: Lost connection during S3 transfer.",
            error: err.message
        }));
    } else {
        // Fallback for non-standard response objects
        res.end();
    }
});

// Apply global centralized error handler
app.use(errorHandler);

// Start the server
app.listen(PORT, () => {
    logger.info(`🚀 S3 Reverse Proxy Active on Port ${PORT}`);
    logger.info(`📂 Bucket: ${S3_BUCKET_NAME}`);
    logger.info(`🌐 Proxy Host: ${S3_BASE_HOST}`);
});
