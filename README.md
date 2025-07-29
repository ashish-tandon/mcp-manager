# MCP Server Manager

A web-based GUI tool for managing Model Context Protocol (MCP) servers in Claude and Cursor. This tool allows you to easily enable/disable MCP servers and their tools through a user-friendly interface.

## Features

- 🎛️ Enable/disable MCP servers with simple toggle switches
- 🔄 Changes are automatically synced between Claude and Cursor
- 🛠️ View available tools for each server
- 🔒 Secure handling of environment variables and API keys
- 📱 Responsive design that works on any screen size
- ⬆️ **NEW:** Automatic update checking for MCP servers with visual indicators
- 🔍 **NEW:** Smart package detection for npm-based MCP servers

![MCP Server Manager Interface](https://github.com/MediaPublishing/mcp-manager/blob/main/MCP-Server-Manager.png?raw=true)

## Installation

1. Clone this repository:
```bash
git clone https://github.com/yourusername/mcp-manager.git
cd mcp-manager
```

2. Install dependencies:
```bash
npm install
```

3. Create a configuration file:
```bash
cp config.example.json config.json
```

4. Start the server:
```bash
npm start
```

5. Open http://localhost:3456 in your browser

## Configuration

The MCP Server Manager uses multiple configuration files:

- `config.json`: Main configuration file defining available MCP servers
- Claude config: Located at `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS)
- Cursor config: Located at `~/Library/Application Support/Cursor/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json` (macOS)

### Configuration Fields

Each server configuration supports the following fields:

- `command`: The command to run the server (e.g., `node`, `npx`)
- `args`: Array of command-line arguments
- `env`: Environment variables for the server
- `disabled`: Boolean to disable the server (optional)
- `npmPackage`: Explicit npm package name for update checking (optional)

### Platform Support

The manager automatically detects the correct configuration paths for:
- **macOS**: `~/Library/Application Support/`
- **Windows**: `%APPDATA%/`
- **Linux**: `~/.config/`

### Supported MCP Servers

The manager works with any MCP server, including popular ones:

- `@modelcontextprotocol/server-filesystem` - File system operations
- `@modelcontextprotocol/server-github` - GitHub integration
- `@modelcontextprotocol/server-brave-search` - Web search via Brave
- `@modelcontextprotocol/server-googlemaps` - Google Maps integration
- `@modelcontextprotocol/server-memory` - Persistent memory
- `@benborla29/mcp-server-mysql` - MySQL database operations
- Custom MCP servers built by the community

### Example Configuration

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
      "disabled": false
    },
    "github": {
      "command": "npx", 
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "your-github-token"
      },
      "disabled": true
    },
    "custom-server": {
      "command": "node",
      "args": ["/path/to/server.js"],
      "npmPackage": "@author/package-name",
      "env": {
        "API_KEY": "your-api-key"
      }
    }
  }
}
```

### Update Checking Configuration

For servers that use npm packages, the MCP Manager can automatically check for updates. There are two ways to configure this:

#### Automatic Detection
The system automatically detects npm packages for:
- `npx` commands (e.g., `npx @modelcontextprotocol/server-github`)
- Traditional installations with recognizable paths

#### Explicit Package Name
For custom or non-standard packages, specify the npm package name explicitly:

```json
{
  "mcp_server_mysql": {
    "command": "/opt/homebrew/bin/node",
    "args": ["/Users/username/mcp-server-mysql/dist/index.js"],
    "npmPackage": "@benborla29/mcp-server-mysql",
    "env": {
      "MYSQL_HOST": "127.0.0.1"
    }
  }
}
```

## Usage

1. Launch the MCP Server Manager
2. Use the toggle switches to enable/disable servers
3. View update status for each server:
   - ✅ **Green badge**: Server is up to date
   - ⬆️ **Orange badge**: Update available (shows current → latest version)
   - ❓ **Gray badge**: Update status unknown
4. Click "🔄 Check Updates" to manually refresh update status
5. Click "Save Changes" to apply your changes
6. Restart Claude to activate the new configuration

### Update Checking

The MCP Manager automatically checks for updates when you load the interface. Update indicators appear on each server card:

- **Up to date**: Green checkmark with current version
- **Update available**: Orange upward arrow with version information
- **Unknown**: Gray question mark (package not found or not npm-based)

Hover over any update indicator to see detailed version information.

### Manual Update Checking

Click the "🔄 Check Updates" button in the navigation to manually refresh the update status for all servers. This is useful if you want to check for new releases without reloading the page.

## API Endpoints

The MCP Manager provides a REST API for programmatic access:

- `GET /api/cursor-config` - Get current Cursor configuration
- `GET /api/claude-config` - Get current Claude configuration  
- `GET /api/tools` - List available tools from enabled servers
- `GET /api/server-updates` - Check for server updates
- `POST /api/save-configs` - Save configuration changes

### Update Checking API

The `/api/server-updates` endpoint returns update information for all configured servers:

```json
{
  "success": true,
  "updates": {
    "server-name": {
      "hasUpdate": false,
      "packageName": "@scope/package-name",
      "currentVersion": "1.0.0",
      "latestVersion": "1.0.0", 
      "reason": "Up to date"
    }
  },
  "totalServers": 3,
  "serversWithUpdates": 0
}
```

## Troubleshooting

### Update Checking Issues

**"Update status unknown"**
- The package name could not be automatically detected
- Add an explicit `npmPackage` field to your server configuration
- Ensure the package exists on npm registry

**"Could not determine current version"** 
- The locally installed version cannot be detected
- This is normal for `npx` installations that download packages on-demand
- The latest version will still be shown

**Update check takes a long time**
- The system queries npm registry for each package
- Slow network connections may cause delays
- Results are cached until manually refreshed

## Keywords

- Model Context Protocol (MCP)
- Claude AI
- Anthropic Claude
- Cursor Editor
- MCP Server Management
- Claude Configuration
- AI Tools Management
- Claude Extensions
- MCP Tools
- AI Development Tools

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built for use with Anthropic's Claude AI
- Compatible with the Cursor editor
- Uses the Model Context Protocol (MCP)
