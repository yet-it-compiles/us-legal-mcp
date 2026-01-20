import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";
import { registerTools } from "./tool-handler.js";
import USLegalAPI from "./us-legal-apis.js";

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize API with environment variables
const usLegalAPI = new USLegalAPI({
  congress: process.env.CONGRESS_API_KEY,
  courtListener: process.env.COURT_LISTENER_API_KEY,
  regulationsGov: process.env.REGULATIONS_GOV_API_KEY,
});

// Log API key status
console.error("🔑 API Key Status:");
console.error(`   Congress.gov: ${process.env.CONGRESS_API_KEY ? "✅" : "❌"}`);
console.error(
  `   CourtListener: ${process.env.COURT_LISTENER_API_KEY ? "✅" : "❌"}`,
);
console.error(
  `   Regulations.gov: ${process.env.REGULATIONS_GOV_API_KEY ? "✅" : "❌"}`,
);

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "us-legal-mcp" });
});

// MCP SSE endpoint
app.get("/sse", async (req, res) => {
  console.log("New SSE connection");

  const server = new Server(
    {
      name: "us-legal-mcp",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  registerTools(server, usLegalAPI);

  const transport = new SSEServerTransport("/message", res);
  await server.connect(transport);
});

// Handle SSE messages
app.post("/message", async (req, res) => {
  // SSE transport handles this
  res.status(200).end();
});

app.listen(PORT, () => {
  console.log(`🇺🇸 US Legal MCP Server running on http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/health`);
  console.log(`   SSE endpoint: http://localhost:${PORT}/sse`);
});
