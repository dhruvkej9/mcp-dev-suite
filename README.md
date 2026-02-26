# MCP Dev Suite 🚀

A high-performance [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server that provides a unified set of tools for modern developers.

## Tools Included

### 📂 File System
- **fs_search**: Search files with glob patterns and content regex.
- **fs_replace**: Batch find and replace across your codebase.

### 🗄️ Database
- **db_sqlite_query**: Run raw SQL against any local SQLite database.

### 🌐 Networking & API
- **http_request**: Make authenticated API calls (GET, POST, etc.) with custom headers.
- **sys_ports**: Inspect active listening ports on your machine.

### 💻 System & Git
- **sys_info**: Detailed system resource monitoring (CPU, RAM, OS).
- **git_status**: Quick overview of your repository state.

## Installation

```bash
npm install
npm run build
```

## Usage with Claude Desktop

Add this to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "dev-suite": {
      "command": "node",
      "args": ["/path/to/mcp-dev-suite/dist/index.js"]
    }
  }
}
```

## Development

```bash
npm run dev
```

Built for the **Claude MCP Tool Integration** bounty.
