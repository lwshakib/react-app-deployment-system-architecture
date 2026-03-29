import express from 'express';
import httpProxy from 'http-proxy';
import dotenv from 'dotenv';
import { ServerResponse } from 'http';
import logger from './logger/winston.logger.js';
import morganMiddleware from './logger/morgan.logger.js';
import { errorHandler } from './middlewares/error.middlewares.js';
import { ApiError } from './utils/ApiError.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 9000;

const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME;
const AWS_REGION = process.env.AWS_REGION || 'ap-south-1';

if (!S3_BUCKET_NAME) {
    logger.error('❌ S3_BUCKET_NAME is not defined in .env');
    process.exit(1);
}

import { postgresService } from './services/postgres.services.js';

app.use(morganMiddleware);

const S3_BASE_HOST = `https://${S3_BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com`;

const proxy = httpProxy.createProxyServer({
    target: S3_BASE_HOST,
    changeOrigin: true,
    secure: false,
});

// UUID Regex to detect specific deployments
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

app.use(async (req, res, next) => {
    const host = req.headers.host || '';
    const subdomain = host.split('.')[0] || '';
    const urlPath = req.url === '/' ? '/index.html' : req.url;

    if (!subdomain) return next(new ApiError(400, "Invalid host."));

    let projectSubdomain = '';
    let deploymentId = '';

    if (UUID_REGEX.test(subdomain)) {
        // 1. Specific Deployment Request: <uuid>.localhost
        deploymentId = subdomain;
        try {
            const result = await postgresService.query(
                'SELECT p.sub_domain FROM projects p JOIN deployments d ON p.id = d.project_id WHERE d.id = $1',
                [deploymentId]
            );
            if (result.rowCount === 0) return next(new ApiError(404, "Deployment not found."));
            const row = result.rows[0];
            if (row && typeof row.sub_domain === 'string') {
                projectSubdomain = row.sub_domain;
            } else {
                return next(new ApiError(500, "Internal error: Subdomain not found."));
            }
        } catch (err) {
            return next(err);
        }
    } else {
        // 2. Main Project Request: <project-name>.localhost
        projectSubdomain = subdomain;
        try {
            const result = await postgresService.query(
                `SELECT d.id FROM deployments d 
                 JOIN projects p ON d.project_id = p.id 
                 WHERE p.sub_domain = $1 AND d.status = 'READY' 
                 ORDER BY d.created_at DESC LIMIT 1`,
                [projectSubdomain]
            );
            if (result.rowCount === 0) return next(new ApiError(404, "No successful deployment found for this project."));
            const row = result.rows[0];
            if (row && typeof row.id === 'string') {
                deploymentId = row.id;
            } else {
                return next(new ApiError(500, "Internal error: Deployment ID not found."));
            }
        } catch (err) {
            return next(err);
        }
    }

    const newPath = `/__outputs/${projectSubdomain}/${deploymentId}${urlPath}`;
    logger.info(`📡 Routing: ${host}${req.url} -> Folder: ${newPath}`);
    
    req.url = newPath;

    return proxy.web(req, res, {}, (err: any) => {
        logger.error(`❌ Proxy Callback Error: ${err.message}`);
        next(new ApiError(502, `Proxy error: Connection to S3 failed. ${err.message}`));
    });
});

proxy.on('proxyReq', (proxyReq) => {
    proxyReq.setHeader('Host', `${S3_BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com`);
});

proxy.on('error', (err, req, res) => {
    logger.error(`❌ Proxy Instance Error: ${err.message}`);
    
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
        res.end();
    }
});

app.use(errorHandler);

app.listen(PORT, () => {
    logger.info(`🚀 S3 Reverse Proxy Active on Port ${PORT}`);
    logger.info(`📂 Bucket: ${S3_BUCKET_NAME}`);
    logger.info(`🌐 Proxy Host: ${S3_BASE_HOST}`);
});
