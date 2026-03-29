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

app.use(morganMiddleware);

const S3_BASE_HOST = `https://${S3_BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com`;

const proxy = httpProxy.createProxyServer({
    target: S3_BASE_HOST,
    changeOrigin: true,
    secure: false,
});

app.use((req, res, next) => {
    const host = req.headers.host || '';
    const subdomain = host.split('.')[0];
    const urlPath = req.url === '/' ? '/index.html' : req.url;

    const newPath = `/__outputs/${subdomain}${urlPath}`;
    logger.info(`📡 Stream: ${host}${req.url} -> Project: ${subdomain} (Target: ${newPath})`);
    
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
