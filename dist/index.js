import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
import fs from "fs/promises";
import axios from "axios";
import Database from "better-sqlite3";
import { globby } from "globby";
import { execSync } from "child_process";
import os from "os";
const server = new Server({
    name: "mcp-dev-suite",
    version: "1.0.0",
}, {
    capabilities: {
        tools: {},
    },
});
/**
 * TOOLS DEFINITION
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "fs_search",
                description: "Search for files using glob patterns and optionally filter by content regex.",
                inputSchema: {
                    type: "object",
                    properties: {
                        directory: { type: "string", description: "The root directory to search in." },
                        pattern: { type: "string", description: "Glob pattern (e.g., '**/*.ts')." },
                        contentRegex: { type: "string", description: "Optional regex to filter files by content." },
                    },
                    required: ["directory", "pattern"],
                },
            },
            {
                name: "fs_replace",
                description: "Perform find and replace across multiple files.",
                inputSchema: {
                    type: "object",
                    properties: {
                        directory: { type: "string", description: "The root directory." },
                        pattern: { type: "string", description: "Glob pattern for files to modify." },
                        find: { type: "string", description: "Regex pattern to find." },
                        replace: { type: "string", description: "Replacement string." },
                        dryRun: { type: "boolean", description: "If true, only returns what would be changed." },
                    },
                    required: ["directory", "pattern", "find", "replace"],
                },
            },
            {
                name: "db_sqlite_query",
                description: "Execute a SQL query against a local SQLite database file.",
                inputSchema: {
                    type: "object",
                    properties: {
                        dbPath: { type: "string", description: "Path to the .sqlite or .db file." },
                        query: { type: "string", description: "The SQL query to execute." },
                        params: { type: "array", items: { type: "string" }, description: "Optional query parameters." },
                    },
                    required: ["dbPath", "query"],
                },
            },
            {
                name: "http_request",
                description: "Make an HTTP request with customizable method, headers, and body.",
                inputSchema: {
                    type: "object",
                    properties: {
                        url: { type: "string", description: "The target URL." },
                        method: { type: "string", enum: ["GET", "POST", "PUT", "DELETE", "PATCH"], default: "GET" },
                        headers: { type: "object", description: "JSON object of headers." },
                        body: { type: "string", description: "Request body string." },
                    },
                    required: ["url"],
                },
            },
            {
                name: "sys_info",
                description: "Get system information (CPU, Memory, OS, Uptime).",
                inputSchema: { type: "object", properties: {} },
            },
            {
                name: "sys_ports",
                description: "List active network ports and the processes using them.",
                inputSchema: { type: "object", properties: {} },
            },
            {
                name: "git_status",
                description: "Get the git status of a directory.",
                inputSchema: {
                    type: "object",
                    properties: {
                        directory: { type: "string", description: "The git repository directory." },
                    },
                    required: ["directory"],
                },
            },
        ],
    };
});
/**
 * TOOLS IMPLEMENTATION
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
        switch (name) {
            case "fs_search": {
                const { directory, pattern, contentRegex } = args;
                const files = await globby(pattern, { cwd: directory, absolute: true });
                let results = files;
                if (contentRegex) {
                    const regex = new RegExp(contentRegex);
                    const filtered = await Promise.all(files.map(async (file) => {
                        const content = await fs.readFile(file, "utf-8");
                        return regex.test(content) ? file : null;
                    }));
                    results = filtered.filter((f) => f !== null);
                }
                return {
                    content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
                };
            }
            case "fs_replace": {
                const { directory, pattern, find, replace, dryRun } = args;
                const files = await globby(pattern, { cwd: directory, absolute: true });
                const regex = new RegExp(find, "g");
                const changes = [];
                for (const file of files) {
                    const content = await fs.readFile(file, "utf-8");
                    if (regex.test(content)) {
                        if (!dryRun) {
                            await fs.writeFile(file, content.replace(regex, replace));
                        }
                        changes.push(file);
                    }
                }
                return {
                    content: [{ type: "text", text: `${dryRun ? "Would have changed" : "Changed"} ${changes.length} files:\n${changes.join("\n")}` }],
                };
            }
            case "db_sqlite_query": {
                const { dbPath, query, params = [] } = args;
                const db = new Database(dbPath);
                const stmt = db.prepare(query);
                let result;
                if (query.trim().toLowerCase().startsWith("select")) {
                    result = stmt.all(...params);
                }
                else {
                    result = stmt.run(...params);
                }
                db.close();
                return {
                    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                };
            }
            case "http_request": {
                const { url, method = "GET", headers = {}, body } = args;
                const response = await axios({
                    url,
                    method,
                    headers,
                    data: body,
                });
                return {
                    content: [{
                            type: "text",
                            text: JSON.stringify({
                                status: response.status,
                                headers: response.headers,
                                data: response.data,
                            }, null, 2)
                        }],
                };
            }
            case "sys_info": {
                const info = {
                    os: `${os.type()} ${os.release()} (${os.arch()})`,
                    cpus: os.cpus().length,
                    loadavg: os.loadavg(),
                    memory: {
                        total: `${Math.round(os.totalmem() / 1024 / 1024)} MB`,
                        free: `${Math.round(os.freemem() / 1024 / 1024)} MB`,
                    },
                    uptime: `${Math.round(os.uptime() / 3600)} hours`,
                };
                return {
                    content: [{ type: "text", text: JSON.stringify(info, null, 2) }],
                };
            }
            case "sys_ports": {
                const output = execSync("netstat -tuln | grep LISTEN").toString();
                return {
                    content: [{ type: "text", text: output }],
                };
            }
            case "git_status": {
                const { directory } = args;
                const output = execSync("git status --short", { cwd: directory }).toString();
                const branch = execSync("git rev-parse --abbrev-ref HEAD", { cwd: directory }).toString().trim();
                return {
                    content: [{ type: "text", text: `Branch: ${branch}\n\n${output || "Clean working directory"}` }],
                };
            }
            default:
                throw new Error(`Unknown tool: ${name}`);
        }
    }
    catch (error) {
        return {
            isError: true,
            content: [{ type: "text", text: `Error: ${error.message}` }],
        };
    }
});
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("MCP Dev Suite server running on stdio");
}
main().catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
});
