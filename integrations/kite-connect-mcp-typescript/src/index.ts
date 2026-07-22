#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

async function main() {
  const { server, logger } = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("Kite Connect MCP server started over stdio");
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
});
