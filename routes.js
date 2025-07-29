import express from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const router = express.Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const execAsync = promisify(exec);

// Get config file paths based on OS
function getConfigPaths() {
    const home = process.env.HOME || process.env.USERPROFILE;
    const isMac = process.platform === 'darwin';
    
    if (isMac) {
        return {
            CURSOR_CONFIG_PATH: path.join(home, 'Library/Application Support/Cursor/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json'),
            CLAUDE_CONFIG_PATH: path.join(home, 'Library/Application Support/Claude/claude_desktop_config.json')
        };
    } else if (process.platform === 'win32') {
        return {
            CURSOR_CONFIG_PATH: path.join(home, 'AppData/Roaming/Cursor/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json'),
            CLAUDE_CONFIG_PATH: path.join(home, 'AppData/Roaming/Claude/claude_desktop_config.json')
        };
    } else {
        // Linux paths
        return {
            CURSOR_CONFIG_PATH: path.join(home, '.config/Cursor/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json'),
            CLAUDE_CONFIG_PATH: path.join(home, '.config/Claude/claude_desktop_config.json')
        };
    }
}

const { CURSOR_CONFIG_PATH, CLAUDE_CONFIG_PATH } = getConfigPaths();

// Helper function to extract package name from server path or command
function extractPackageInfo(serverPath, serverConfig) {
    if (!serverPath && !serverConfig) return null;
    
    // First check if npmPackage is explicitly specified in config
    if (serverConfig && serverConfig.npmPackage) {
        return {
            name: serverConfig.npmPackage,
            isScoped: serverConfig.npmPackage.startsWith('@'),
            explicit: true
        };
    }
    
    // Handle npx commands first
    if (serverConfig && serverConfig.command === 'npx' && serverConfig.args) {
        // Skip npx flags like -y and get the package name
        const packageArg = serverConfig.args.find(arg => !arg.startsWith('-') && arg !== 'npx');
        if (packageArg) {
            // Check if it's a scoped package
            if (packageArg.startsWith('@')) {
                return {
                    name: packageArg,
                    isScoped: true
                };
            } else {
                return {
                    name: packageArg,
                    isScoped: false
                };
            }
        }
    }
    
    // Fall back to path-based detection for traditional installations
    if (serverPath) {
        const patterns = [
            // Scoped packages: @scope/package-name
            /@([^/]+)\/([^/]+)/,
            // Regular packages in node_modules
            /node_modules\/([^/@][^/]+)/,
            // Local packages (extract from directory name)
            /([^/]*mcp[^/]*)\//i
        ];
        
        for (const pattern of patterns) {
            const match = serverPath.match(pattern);
            if (match) {
                if (pattern.source.includes('@')) {
                    // Scoped package
                    return { 
                        name: `@${match[1]}/${match[2]}`,
                        isScoped: true
                    };
                } else {
                    // Regular package
                    return {
                        name: match[1],
                        isScoped: false
                    };
                }
            }
        }
    }
    
    return null;
}

// Helper function to try multiple package name variations
async function tryMultiplePackageNames(baseName, serverPath) {
    const variations = [
        baseName,
        `@modelcontextprotocol/server-${baseName.replace(/^mcp-?server-?/, '')}`,
        `@anthropic/mcp-server-${baseName.replace(/^mcp-?server-?/, '')}`,
        `@benborla29/mcp-server-${baseName.replace(/^mcp-?server-?/, '')}`,
        `mcp-server-${baseName.replace(/^mcp-?server-?/, '')}`,
        baseName.replace(/_/g, '-') // Convert underscores to hyphens
    ];
    
    // Add variations based on directory name if available
    if (serverPath) {
        const dirMatch = serverPath.match(/\/([^/]+)\/(?:dist|build|src)\//);
        if (dirMatch && dirMatch[1] !== baseName) {
            const dirName = dirMatch[1];
            variations.push(
                dirName,
                `@modelcontextprotocol/${dirName}`,
                `@anthropic/${dirName}`,
                `@benborla29/${dirName}`,
                dirName.replace(/_/g, '-'),
                `@modelcontextprotocol/${dirName.replace(/_/g, '-')}`,
                `@anthropic/${dirName.replace(/_/g, '-')}`,
                `@benborla29/${dirName.replace(/_/g, '-')}`
            );
        }
    }
    
    // Remove duplicates and try each variation
    const uniqueVariations = [...new Set(variations)];
    
    for (const packageName of uniqueVariations) {
        try {
            const version = await getLatestVersion(packageName);
            if (version) {
                console.log(`Found package: ${packageName} -> ${version}`);
                return { packageName, version };
            }
        } catch (error) {
            // Continue trying other variations
            continue;
        }
    }
    
    return null;
}

// Helper function to get current installed version of a package
async function getCurrentVersion(packageName, serverPath) {
    try {
        // Try to find package.json in the server directory
        const serverDir = path.dirname(serverPath);
        let currentDir = serverDir;
        
        // Walk up directories to find node_modules or package.json
        for (let i = 0; i < 5; i++) {
            try {
                const packageJsonPath = path.join(currentDir, 'package.json');
                const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
                if (packageJson.name === packageName) {
                    return packageJson.version;
                }
            } catch (e) {
                // Continue searching
            }
            
            // Check in node_modules
            try {
                const nodeModulesPath = path.join(currentDir, 'node_modules', packageName, 'package.json');
                const packageJson = JSON.parse(await fs.readFile(nodeModulesPath, 'utf8'));
                return packageJson.version;
            } catch (e) {
                // Continue searching
            }
            
            currentDir = path.dirname(currentDir);
        }
        
        // Try npm list as fallback
        try {
            const { stdout } = await execAsync(`npm list ${packageName} --depth=0 --json`, {
                cwd: process.cwd(),
                timeout: 5000
            });
            const npmList = JSON.parse(stdout);
            if (npmList.dependencies && npmList.dependencies[packageName]) {
                return npmList.dependencies[packageName].version;
            }
        } catch (e) {
            console.log(`Could not get version for ${packageName} via npm list`);
        }
        
        return null;
    } catch (error) {
        console.error(`Error getting current version for ${packageName}:`, error);
        return null;
    }
}

// Helper function to get latest version from npm registry
async function getLatestVersion(packageName) {
    try {
        const { stdout } = await execAsync(`npm view ${packageName} version --json`, {
            timeout: 10000
        });
        return stdout.trim().replace(/"/g, '');
    } catch (error) {
        console.error(`Error getting latest version for ${packageName}:`, error);
        return null;
    }
}

// Helper function to compare versions (simplified semantic versioning)
function isNewerVersion(current, latest) {
    if (!current || !latest) return false;
    
    const currentParts = current.split('.').map(Number);
    const latestParts = latest.split('.').map(Number);
    
    for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i++) {
        const currentPart = currentParts[i] || 0;
        const latestPart = latestParts[i] || 0;
        
        if (latestPart > currentPart) return true;
        if (latestPart < currentPart) return false;
    }
    
    return false;
}

// Helper function to read config files
async function readConfigFile(filePath) {
    try {
        console.log('Reading config file:', filePath);
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log('No existing config found, using empty config');
            return { mcpServers: {} };
        }
        console.error(`Error reading ${filePath}:`, error);
        throw error;
    }
}

// Helper function to merge configurations
function mergeConfigs(savedConfig, defaultConfig) {
    console.log('Merging configs:');
    console.log('Saved servers:', Object.keys(savedConfig.mcpServers || {}));
    console.log('Default servers:', Object.keys(defaultConfig));
    
    const mergedServers = {};
    
    // Start with all default servers
    Object.entries(defaultConfig).forEach(([name, config]) => {
        mergedServers[name] = { ...config };
    });
    
    // Override with saved configurations
    Object.entries(savedConfig.mcpServers || {}).forEach(([name, config]) => {
        mergedServers[name] = {
            ...mergedServers[name],
            ...config
        };
    });
    
    console.log('Merged servers:', Object.keys(mergedServers));
    return { mcpServers: mergedServers };
}

// Helper function to filter out disabled servers
function filterDisabledServers(config) {
    const filteredConfig = { mcpServers: {} };
    
    Object.entries(config.mcpServers).forEach(([name, server]) => {
        // Only include servers that are not disabled
        if (!server.disabled) {
            // Create a new server object without the disabled property
            const { disabled, ...serverConfig } = server;
            filteredConfig.mcpServers[name] = serverConfig;
        } else {
            console.log(`Filtering out disabled server: ${name}`);
        }
    });
    
    console.log('Filtered servers:', Object.keys(filteredConfig.mcpServers));
    return filteredConfig;
}

// Get cursor config
router.get('/cursor-config', async (req, res) => {
    console.log('Handling /api/cursor-config request');
    try {
        const savedConfig = await readConfigFile(CURSOR_CONFIG_PATH);
        const defaultConfig = await readConfigFile(path.join(__dirname, 'config.json'));
        const mergedConfig = mergeConfigs(savedConfig, defaultConfig.mcpServers || {});
        console.log('Returning merged config with servers:', Object.keys(mergedConfig.mcpServers));
        res.json(mergedConfig);
    } catch (error) {
        console.error('Error in /api/cursor-config:', error);
        res.status(500).json({ error: `Failed to read Cursor config: ${error.message}` });
    }
});

// Get claude config
router.get('/claude-config', async (req, res) => {
    console.log('Handling /api/claude-config request');
    try {
        const config = await readConfigFile(CLAUDE_CONFIG_PATH);
        res.json(config);
    } catch (error) {
        console.error('Error in /api/claude-config:', error);
        res.status(500).json({ error: `Failed to read Claude config: ${error.message}` });
    }
});

// Get tools list
router.get('/tools', async (req, res) => {
    console.log('Handling /api/tools request');
    try {
        const cursorConfig = await readConfigFile(CURSOR_CONFIG_PATH);
        const defaultConfig = await readConfigFile(path.join(__dirname, 'config.json'));
        const mergedConfig = mergeConfigs(cursorConfig, defaultConfig.mcpServers || {});
        const servers = mergedConfig.mcpServers;

        // Define available tools for each server
        const toolsMap = {
            'mcp-manager': [{
                name: 'launch_manager',
                description: 'Launch the MCP Server Manager interface',
                inputSchema: {
                    type: 'object',
                    properties: {},
                    required: []
                }
            }]
        };

        // Filter tools based on enabled servers
        const enabledTools = Object.entries(toolsMap)
            .filter(([serverName]) => {
                return servers[serverName] && !servers[serverName].disabled;
            })
            .flatMap(([serverName, tools]) => 
                tools.map(tool => ({
                    ...tool,
                    server: serverName
                }))
            );

        console.log(`Returning ${enabledTools.length} tools`);
        res.json(enabledTools);
    } catch (error) {
        console.error('Error in /api/tools:', error);
        res.status(500).json({ error: error.message });
    }
});

// Helper function to ensure directory exists
async function ensureDirectoryExists(filePath) {
    const dir = path.dirname(filePath);
    try {
        await fs.mkdir(dir, { recursive: true });
    } catch (error) {
        // Directory might already exist, ignore error
        if (error.code !== 'EEXIST') {
            throw error;
        }
    }
}

// Save configs
router.post('/save-configs', async (req, res) => {
    console.log('Handling /api/save-configs request');
    try {
        const { mcpServers } = req.body;
        if (!mcpServers) {
            throw new Error('No server configuration provided');
        }

        // Ensure directories exist before writing files
        await ensureDirectoryExists(CURSOR_CONFIG_PATH);
        await ensureDirectoryExists(CLAUDE_CONFIG_PATH);

        // Save full config to Cursor settings (for UI state)
        const fullConfig = { mcpServers };
        await fs.writeFile(CURSOR_CONFIG_PATH, JSON.stringify(fullConfig, null, 2));

        // Save filtered config to Claude settings (removing disabled servers)
        const filteredConfig = filterDisabledServers(fullConfig);
        console.log('Filtered config for Claude:', JSON.stringify(filteredConfig, null, 2));
        await fs.writeFile(CLAUDE_CONFIG_PATH, JSON.stringify(filteredConfig, null, 2));

        console.log('Configurations saved successfully');
        res.json({ 
            success: true, 
            message: 'Configurations saved successfully. Please restart Claude to apply changes.' 
        });
    } catch (error) {
        console.error('Error in /api/save-configs:', error);
        res.status(500).json({ error: `Failed to save configurations: ${error.message}` });
    }
});

// Check for server updates
router.get('/server-updates', async (req, res) => {
    console.log('Handling /api/server-updates request');
    try {
        const cursorConfig = await readConfigFile(CURSOR_CONFIG_PATH);
        const defaultConfig = await readConfigFile(path.join(__dirname, 'config.json'));
        const mergedConfig = mergeConfigs(cursorConfig, defaultConfig.mcpServers || {});
        const servers = mergedConfig.mcpServers;

        const updateInfo = {};
        
        // Check each server for updates
        const updatePromises = Object.entries(servers).map(async ([serverName, config]) => {
            const serverPath = Array.isArray(config.args) ? config.args[0] : '';
            const packageInfo = extractPackageInfo(serverPath, config);
            
            if (!packageInfo) {
                updateInfo[serverName] = {
                    hasUpdate: false,
                    reason: 'Unable to determine package name',
                    currentVersion: null,
                    latestVersion: null
                };
                return;
            }

            try {
                let currentVersion = null;
                let latestVersion = null;
                let finalPackageName = packageInfo.name;

                // Try to get the latest version
                try {
                    latestVersion = await getLatestVersion(packageInfo.name);
                } catch (error) {
                    // If the initial package name fails, try variations (unless explicitly specified)
                    if (!packageInfo.explicit) {
                        console.log(`Package ${packageInfo.name} not found, trying variations...`);
                        const result = await tryMultiplePackageNames(packageInfo.name, serverPath);
                        if (result) {
                            finalPackageName = result.packageName;
                            latestVersion = result.version;
                        }
                    }
                }

                // Try to get current version
                if (latestVersion) {
                    currentVersion = await getCurrentVersion(finalPackageName, serverPath);
                }

                const hasUpdate = isNewerVersion(currentVersion, latestVersion);
                
                updateInfo[serverName] = {
                    hasUpdate,
                    packageName: finalPackageName,
                    currentVersion,
                    latestVersion,
                    reason: !currentVersion ? 'Could not determine current version' :
                           !latestVersion ? 'Could not fetch latest version' :
                           hasUpdate ? 'Update available' : 'Up to date'
                };
            } catch (error) {
                console.error(`Error checking updates for ${serverName}:`, error);
                updateInfo[serverName] = {
                    hasUpdate: false,
                    reason: `Error: ${error.message}`,
                    currentVersion: null,
                    latestVersion: null
                };
            }
        });

        await Promise.all(updatePromises);
        
        const serversWithUpdates = Object.values(updateInfo).filter(info => info.hasUpdate).length;
        console.log(`Found updates for ${serversWithUpdates} servers`);
        
        res.json({
            success: true,
            updates: updateInfo,
            totalServers: Object.keys(servers).length,
            serversWithUpdates
        });
    } catch (error) {
        console.error('Error in /api/server-updates:', error);
        res.status(500).json({ error: `Failed to check for updates: ${error.message}` });
    }
});

export default router;
