import express from 'express';
import httpProxy from 'http-proxy';
import dotenv from 'dotenv';
import path from 'path';
import { ServerResponse } from 'http';

// Load environment variables from the proxy directory .env
dotenv.config();

const app = express();
const PORT = process.env.PORT || 9000;

const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME;
const AWS_REGION = process.env.AWS_REGION || 'ap-south-1';

if (!S3_BUCKET_NAME) {
    console.error('❌ S3_BUCKET_NAME is not defined in .env');
    process.exit(1);
}

// S3 Base Host (without path)
const S3_BASE_HOST = `https://${S3_BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com`;

const proxy = httpProxy.createProxyServer({
    target: S3_BASE_HOST,
    changeOrigin: true,
    secure: false, // Bypass SSL validation for local testing if needed
});

app.use((req, res) => {
    const host = req.headers.host || '';
    // Extract subdomain from host (e.g., 'project.localhost' -> 'project')
    const subdomain = host.split('.')[0];
    const urlPath = req.url === '/' ? '/index.html' : req.url;

    // Rewrite URL to point to the correct output folder in S3: /__outputs/[subdomain]/[file]
    const newPath = `/__outputs/${subdomain}${urlPath}`;
    console.log(`📡 Incoming: ${host}${req.url} -> Project: ${subdomain} (Rewriting to: ${newPath})`);
    
    // Mutate req.url before passing to proxy.web. This is safe and standard for http-proxy.
    req.url = newPath;

    // Fix: Match the 4-argument signature of proxy.web (req, res, options, callback)
    return proxy.web(req, res, {}, (err: any) => {
        console.error('❌ Proxy Web Error Callback:', err.message);
        if (res instanceof ServerResponse) {
            if (!res.headersSent) {
                res.writeHead(502, { 'Content-Type': 'text/plain' });
            }
            res.end('Proxy error: Connection to S3 failed.');
        } else {
            // res is typed as Socket or ServerResponse. We handle Socket cases here.
            (res as any).end?.();
        }
    });
});

// Intercept and rewrite the request path for S3 __outputs folder
proxy.on('proxyReq', (proxyReq, req, res) => {
    // S3 MANDATORY: The Host header must match the bucket endpoint for AWS to accept the request
    // Setting Host header in proxyReq event is safe and effective.
    proxyReq.setHeader('Host', `${S3_BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com`);
});

// Graceful error handling for proxy timeouts or connection resets
proxy.on('error', (err, req, res) => {
    console.error('❌ Proxy Instance Error:', err.message);
    
    if (res instanceof ServerResponse) {
        if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
        }
        res.end('Deployment Proxy Error: Lost connection during S3 transfer.');
    } else {
        res.end();
    }
});

app.listen(PORT, () => {
    console.log(`🚀 S3 Reverse Proxy Active on Port ${PORT}`);
    console.log(`📂 Bucket: ${S3_BUCKET_NAME}`);
    console.log(`🌐 Proxy Host: ${S3_BASE_HOST}`);
});
