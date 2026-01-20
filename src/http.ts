import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTools } from "./tool-handler.js";
import USLegalAPI from "./us-legal-apis.js";

// HARD-CODED API KEYS — ONLY WHAT YOU HAVE
const usLegalAPI = new USLegalAPI({
  congress: "PIbKGaz1RXNwIgp2qZDbpboNdDu5Ao664b5CIrmr",
  courtListener: "affcbb0fc168ba0e5dc1b1e30e09556afbe6211c",
});

// MCP SERVER
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

// REGISTER TOOLS
registerTools(server, usLegalAPI);

// AGENT BUILDER–COMPATIBLE TRANSPORT
const transport = new StdioServerTransport();
await server.connect(transport);
