import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadConfig } from "./config.js";
import { KiteClient } from "./kite-client.js";
import { Logger } from "./logger.js";
import { registerTools } from "./tools.js";

export function createServer() {
  const config = loadConfig();
  const logger = new Logger(config.logLevel);
  const client = new KiteClient(config, logger);
  const server = new McpServer({
    name: "kite-connect-mcp-server",
    version: "0.1.0"
  });

  registerTools(server, client);
  return { server, logger };
}
