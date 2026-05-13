# S3 Reverse Proxy 🌐

The entry point for serving built applications. This service acts as a specialized reverse proxy that dynamically maps subdomains to S3-hosted assets.

## 🏗️ Core Logic

The S3 Reverse Proxy follows a structured request-handling process:
1.  **Extract Subdomain**: Identifies the specific deployment by parsing the incoming hostname (e.g., `user-repo.localhost:8080`).
2.  **Determine Path**: Maps the subdomain to the corresponding S3 bucket prefix.
3.  **Proxy Request**: Fetches the requested file from S3 using the AWS SDK.
4.  **Serve File**: Adds appropriate `Content-Type` headers based on file extension (`html`, `js`, `css`, `png`, etc.).
5.  **SPA Support**: Automatically serves `index.html` for any 404s, enabling client-side routing.

## 🛠️ Setup & Running

### Environment Variables
Copy `.env.example` to `.env` and configure:
- `S3_BUCKET_NAME`: The S3 bucket where apps are stored.
- `AWS_REGION`: Region of your S3 bucket.
- `PORT`: Port for the proxy to listen on (e.g., `8080`).

### Development
```bash
bun install
bun run dev
```

### Production
For high availability, host the proxy on an EC2 or ECS service with a wildcard SSL certificate (e.g., `*.yourdomain.com`).

## 📡 Dynamic Routing Summary
A request to `http://test-123.localhost:8080/main.js` will fetch:
- `Bucket`: `S3_BUCKET_NAME`
- `Key`: `outputs/test-123/main.js`
