import express, { Request, Response } from "express";

const app = express();
const port = process.env.PORT || 8000;

// Middleware for parsing JSON
app.use(express.json());

// Root endpoint: Welcome message
app.get("/", (req: Request, res: Response) => {
  res.json({
    message: "🚀 Express server is running on Bun!",
    status: "Healthy",
    timestamp: new Date().toISOString(),
    system: {
      runtime: "Bun",
      nodeVersion: process.version,
    },
  });
});

// Start the server
app.listen(port, () => {
  console.log(`\n✨ Server is glowing at http://localhost:${port}`);
  console.log(`📦 Runtime: Bun`);
  console.log(`📡 Environment: ${process.env.NODE_ENV || "development"}\n`);
});