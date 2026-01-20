import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import type { Request, Response } from "express";
import express from "express";
import { registerTools } from "./tool-handler.js";
import USLegalAPI from "./us-legal-apis.js";

const app = express();
const PORT = process.env.PORT || 3000;

const usLegalAPI = new USLegalAPI({
  congress: process.env.CONGRESS_API_KEY,
  courtListener: process.env.COURT_LISTENER_API_KEY,
});

console.error("API Key Status:");
console.error(
  `Congress.gov: ${process.env.CONGRESS_API_KEY ? "OK" : "MISSING"}`,
);
console.error(
  `CourtListener: ${process.env.COURT_LISTENER_API_KEY ? "OK" : "MISSING"}`,
);

app.get("/", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    service: "us-legal-mcp",
    endpoints: {
      health: "/health",
      mcp: "/mcp",
      sse: "/sse",
      message: "/message",
    },
  });
});

app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok", service: "us-legal-mcp" });
});

async function handleMcpSse(_req: Request, res: Response) {
  const server = new Server(
    { name: "us-legal-mcp", version: "1.0.0" },
    { capabilities: { tools: {} } },
  );

  registerTools(server, usLegalAPI);

  const transport = new SSEServerTransport("/message", res);
  await server.connect(transport);
}

app.get("/sse", handleMcpSse);
app.get("/mcp", handleMcpSse);

app.post("/message", (_req: Request, res: Response) => {
  res.status(200).end();
});

app.listen(PORT, () => {
  console.log(`US Legal MCP running on port ${PORT}`);
  console.log(`Root: /`);
  console.log(`Health: /health`);
  console.log(`SSE: /sse`);
  console.log(`MCP: /mcp`);
});
