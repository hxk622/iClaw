#!/usr/bin/env node

/**
 * Agent Browser MCP Server
 *
 * Wraps the agent-browser CLI as an MCP server for token-efficient
 * browser automation. Uses accessibility tree snapshots (text) instead
 * of screenshots (base64 images), reducing token usage by ~20-100x.
 *
 * Core workflow:
 *   1. browser_navigate → open a URL
 *   2. browser_snapshot → get accessibility tree with refs (@e1, @e2, ...)
 *   3. browser_click / browser_fill → interact using refs
 *   4. browser_snapshot → re-snapshot after page changes
 */

import { execSync } from 'child_process';
import { readFileSync, unlinkSync } from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { pathToFileURL } from 'url';

const requireResolvers = [createRequire(import.meta.url)];
const runtimeRoot = process.env.ICLAW_OPENCLAW_RUNTIME_ROOT?.trim();
if (runtimeRoot) {
  for (const candidate of [
    path.join(runtimeRoot, 'openclaw', 'package.json'),
    path.join(runtimeRoot, 'package.json'),
  ]) {
    try {
      requireResolvers.push(createRequire(pathToFileURL(candidate).href));
    } catch {}
  }
}

async function importMcpModule(specifier, fallbackResolver) {
  try {
    return await import(specifier);
  } catch (error) {
    if (!fallbackResolver) throw error;
    const fallbackPath = fallbackResolver();
    return import(pathToFileURL(fallbackPath).href);
  }
}

function resolveMcpModule(specifier) {
  for (const resolver of requireResolvers) {
    try {
      return resolver.resolve(specifier);
    } catch {}
  }
  throw new Error(`Unable to resolve ${specifier} from agent-browser MCP runtime`);
}

const { Server } = await importMcpModule(
  '@modelcontextprotocol/sdk/server/index.js',
  () => resolveMcpModule('@modelcontextprotocol/sdk/server/index.js')
);
const { StdioServerTransport } = await importMcpModule(
  '@modelcontextprotocol/sdk/server/stdio.js',
  () => resolveMcpModule('@modelcontextprotocol/sdk/server/stdio.js')
);
const { CallToolRequestSchema, ListToolsRequestSchema } = await importMcpModule(
  '@modelcontextprotocol/sdk/types.js',
  () => resolveMcpModule('@modelcontextprotocol/sdk/types.js')
);

// ============================================================================
// Config
// ============================================================================

const COMMAND_TIMEOUT_MS = 30_000;
const MAX_BUFFER = 10 * 1024 * 1024; // 10MB

// ============================================================================
// Helper
// ============================================================================

function run(args) {
  try {
    const result = execSync(`agent-browser ${args}`, {
      encoding: 'utf-8',
      timeout: COMMAND_TIMEOUT_MS,
      maxBuffer: MAX_BUFFER,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return result.trim();
  } catch (error) {
    if (error.stdout) return error.stdout.trim();
    throw new Error(`agent-browser failed: ${error.message}`);
  }
}

// ============================================================================
// Tools Definition
// ============================================================================

const TOOLS = [
  {
    name: 'browser_navigate',
    description: 'Navigate to a URL. Opens the browser if not already open.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to navigate to' },
      },
      required: ['url'],
    },
  },
  {
    name: 'browser_snapshot',
    description:
      'Get the current page as an accessibility tree (text). Returns interactive elements with refs like @e1, @e2 that can be used with click/fill/type. This is extremely token-efficient compared to screenshots.',
    inputSchema: {
      type: 'object',
      properties: {
        interactive: {
          type: 'boolean',
          description: 'Only show interactive elements (default: true)',
        },
        compact: {
          type: 'boolean',
          description: 'Remove empty structural elements (default: true)',
        },
        selector: {
          type: 'string',
          description: 'Scope snapshot to a CSS selector',
        },
      },
    },
  },
  {
    name: 'browser_click',
    description: 'Click an element by @ref (from snapshot) or CSS selector.',
    inputSchema: {
      type: 'object',
      properties: {
        selector: {
          type: 'string',
          description: 'Element ref (e.g. @e1) or CSS selector',
        },
      },
      required: ['selector'],
    },
  },
  {
    name: 'browser_fill',
    description:
      'Clear and fill an input element. Use @ref from snapshot or CSS selector.',
    inputSchema: {
      type: 'object',
      properties: {
        selector: {
          type: 'string',
          description: 'Element ref (e.g. @e3) or CSS selector',
        },
        text: { type: 'string', description: 'Text to fill' },
      },
      required: ['selector', 'text'],
    },
  },
  {
    name: 'browser_type',
    description:
      'Type text into an element (appends, does not clear). Use for search boxes etc.',
    inputSchema: {
      type: 'object',
      properties: {
        selector: {
          type: 'string',
          description: 'Element ref or CSS selector',
        },
        text: { type: 'string', description: 'Text to type' },
      },
      required: ['selector', 'text'],
    },
  },
  {
    name: 'browser_press',
    description:
      'Press a keyboard key (e.g. Enter, Tab, Escape, Control+a).',
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Key to press' },
      },
      required: ['key'],
    },
  },
  {
    name: 'browser_select',
    description: 'Select an option from a dropdown.',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'Element ref or CSS selector' },
        value: { type: 'string', description: 'Option value to select' },
      },
      required: ['selector', 'value'],
    },
  },
  {
    name: 'browser_scroll',
    description: 'Scroll the page in a direction.',
    inputSchema: {
      type: 'object',
      properties: {
        direction: {
          type: 'string',
          enum: ['up', 'down', 'left', 'right'],
          description: 'Scroll direction',
        },
        pixels: {
          type: 'number',
          description: 'Pixels to scroll (default: 500)',
        },
      },
      required: ['direction'],
    },
  },
  {
    name: 'browser_hover',
    description: 'Hover over an element.',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'Element ref or CSS selector' },
      },
      required: ['selector'],
    },
  },
  {
    name: 'browser_get',
    description:
      'Get information from an element: text, html, value, title, url, or count.',
    inputSchema: {
      type: 'object',
      properties: {
        what: {
          type: 'string',
          enum: ['text', 'html', 'value', 'title', 'url', 'count'],
          description: 'What to get',
        },
        selector: {
          type: 'string',
          description: 'Element ref or CSS selector (not needed for title/url)',
        },
      },
      required: ['what'],
    },
  },
  {
    name: 'browser_eval',
    description: 'Execute JavaScript in the browser context and return the result.',
    inputSchema: {
      type: 'object',
      properties: {
        script: { type: 'string', description: 'JavaScript code to execute' },
      },
      required: ['script'],
    },
  },
  {
    name: 'browser_screenshot',
    description:
      'Take a screenshot (fallback when visual context is needed). Returns base64 image. Prefer browser_snapshot for token efficiency.',
    inputSchema: {
      type: 'object',
      properties: {
        full: {
          type: 'boolean',
          description: 'Full page screenshot (default: false)',
        },
      },
    },
  },
  {
    name: 'browser_wait',
    description: 'Wait for an element to appear or a specified time in ms.',
    inputSchema: {
      type: 'object',
      properties: {
        target: {
          type: 'string',
          description: 'CSS selector to wait for, or milliseconds (e.g. "2000")',
        },
      },
      required: ['target'],
    },
  },
  {
    name: 'browser_back',
    description: 'Navigate back in browser history.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'browser_forward',
    description: 'Navigate forward in browser history.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'browser_tab',
    description: 'Manage browser tabs: new, list, close, or switch to tab number.',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['new', 'list', 'close'],
          description: 'Tab action',
        },
        index: {
          type: 'number',
          description: 'Tab index to switch to (use instead of action)',
        },
      },
    },
  },
  {
    name: 'browser_close',
    description: 'Close the browser.',
    inputSchema: { type: 'object', properties: {} },
  },
];

// ============================================================================
// Tool Execution
// ============================================================================

function executeTool(name, args) {
  switch (name) {
    case 'browser_navigate':
      return run(`open "${args.url}"`);

    case 'browser_snapshot': {
      const flags = [];
      if (args.interactive !== false) flags.push('-i');
      if (args.compact !== false) flags.push('-c');
      if (args.selector) flags.push(`-s "${args.selector}"`);
      return run(`snapshot ${flags.join(' ')}`);
    }

    case 'browser_click':
      return run(`click "${args.selector}"`);

    case 'browser_fill':
      return run(`fill "${args.selector}" "${args.text}"`);

    case 'browser_type':
      return run(`type "${args.selector}" "${args.text}"`);

    case 'browser_press':
      return run(`press ${args.key}`);

    case 'browser_select':
      return run(`select "${args.selector}" "${args.value}"`);

    case 'browser_scroll': {
      const px = args.pixels || 500;
      return run(`scroll ${args.direction} ${px}`);
    }

    case 'browser_hover':
      return run(`hover "${args.selector}"`);

    case 'browser_get': {
      const sel = args.selector ? `"${args.selector}"` : '';
      return run(`get ${args.what} ${sel}`);
    }

    case 'browser_eval':
      return run(`eval "${args.script.replace(/"/g, '\\"')}"`);

    case 'browser_screenshot': {
      // Return screenshot as base64 for MCP image content
      const flags = args.full ? '--full' : '';
      const tmpPath = `/tmp/agent-browser-screenshot-${Date.now()}.png`;
      run(`screenshot ${tmpPath} ${flags}`);
      const data = readFileSync(tmpPath);
      unlinkSync(tmpPath);
      return { type: 'image', data: data.toString('base64'), mimeType: 'image/png' };
    }

    case 'browser_wait':
      return run(`wait ${args.target}`);

    case 'browser_back':
      return run('back');

    case 'browser_forward':
      return run('forward');

    case 'browser_tab': {
      if (args.index !== undefined) return run(`tab ${args.index}`);
      return run(`tab ${args.action || 'list'}`);
    }

    case 'browser_close':
      return run('close');

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ============================================================================
// Server Setup
// ============================================================================

const server = new Server(
  { name: 'agent-browser', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  try {
    const result = executeTool(name, args);

    // Handle image results (screenshot)
    if (result && typeof result === 'object' && result.type === 'image') {
      return {
        content: [
          {
            type: 'image',
            data: result.data,
            mimeType: result.mimeType,
          },
        ],
      };
    }

    return {
      content: [{ type: 'text', text: result || 'Done' }],
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Error: ${error.message}` }],
      isError: true,
    };
  }
});

// Start
const transport = new StdioServerTransport();
await server.connect(transport);
