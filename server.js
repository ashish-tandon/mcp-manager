import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import apiRoutes from './routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const port = process.env.PORT || 3116;  // ✅ Fixed: was 3456

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint for MCP ecosystem
app.get('/health', (req, res) => {
    res.json({
        status: 'MCP Manager Server - Healthy',
        port: port,
        service: 'mcp-manager',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// Status endpoint
app.get('/status', (req, res) => {
    res.json({
        service: 'mcp-manager',
        status: 'operational',
        port: port,
        version: '1.0.0'
    });
});

// API Routes
console.log('Mounting API routes at /api');
app.use('/api', apiRoutes);

// Static file serving
const staticDir = __dirname;
console.log('Setting up static file serving from:', staticDir);

app.use(express.static(staticDir));

// Serve index.html for all other routes
app.get('*', (req, res) => {
    console.log('Serving index.html for:', req.path);
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 MCP Manager running at http://localhost:${port}`);
    console.log(`🔍 Health check available at http://localhost:${port}/health`);
    console.log('Current directory:', __dirname);
    console.log('Available routes:');
    console.log('  GET  /health');
    console.log('  GET  /status');
    console.log('  GET  /api/cursor-config');
    console.log('  GET  /api/claude-config');
    console.log('  GET  /api/tools');
    console.log('  GET  /api/server-updates');
    console.log('  POST /api/save-configs');
});
