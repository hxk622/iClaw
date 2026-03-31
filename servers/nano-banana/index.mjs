#!/usr/bin/env node

import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { createRequire } from 'module';
import { pathToFileURL } from 'url';

const DEFAULT_MODEL = 'gemini-3.1-flash-image-preview';
const DEFAULT_CONFIG_FILE = '.nano-banana-config.json';

const requireResolvers = [createRequire(import.meta.url)];
const runtimeRoot = process.env.ICLAW_OPENCLAW_RUNTIME_ROOT?.trim();
for (const candidate of [
  runtimeRoot ? path.join(runtimeRoot, 'openclaw', 'package.json') : null,
  runtimeRoot ? path.join(runtimeRoot, 'package.json') : null,
  path.resolve(import.meta.dirname, '../../services/openclaw/runtime/openclaw/package.json'),
]) {
  if (!candidate) continue;
  try {
    requireResolvers.push(createRequire(pathToFileURL(candidate).href));
  } catch {}
}

function resolveModule(specifier) {
  for (const resolver of requireResolvers) {
    try {
      return resolver.resolve(specifier);
    } catch {}
  }
  throw new Error(`Unable to resolve module: ${specifier}`);
}

async function importModule(specifier) {
  try {
    return await import(specifier);
  } catch {
    return import(pathToFileURL(resolveModule(specifier)).href);
  }
}

const [{ Server }, { StdioServerTransport }, { CallToolRequestSchema, ListToolsRequestSchema, ErrorCode, McpError }, { GoogleGenAI }, { z }] =
  await Promise.all([
    importModule('@modelcontextprotocol/sdk/server/index.js'),
    importModule('@modelcontextprotocol/sdk/server/stdio.js'),
    importModule('@modelcontextprotocol/sdk/types.js'),
    importModule('@google/genai'),
    importModule('zod'),
  ]);

try {
  const { config } = await importModule('dotenv');
  config();
} catch {}

const ConfigSchema = z.object({
  geminiApiKey: z.string().min(1, 'Gemini API key is required'),
  model: z.string().min(1).optional(),
  baseUrl: z.string().min(1).optional(),
  apiVersion: z.string().min(1).optional(),
});

function cleanString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function resolveModel(raw) {
  return cleanString(raw) || DEFAULT_MODEL;
}

function normalizeBaseUrl(raw) {
  const value = cleanString(raw);
  return value ? value.replace(/\/+$/, '') : null;
}

function buildGenAiClient(options) {
  const httpOptions = {};
  if (options.baseUrl) {
    httpOptions.baseUrl = options.baseUrl;
  }
  if (options.apiVersion) {
    httpOptions.apiVersion = options.apiVersion;
  }
  return new GoogleGenAI({
    apiKey: options.geminiApiKey,
    ...(Object.keys(httpOptions).length ? { httpOptions } : {}),
  });
}

class NanoBananaMcpServer {
  constructor() {
    this.server = new Server(
      { name: 'nano-banana-mcp', version: '1.1.0' },
      { capabilities: { tools: {} } },
    );
    this.config = null;
    this.genAI = null;
    this.lastImagePath = null;
    this.configSource = 'not_configured';
    this.setupHandlers();
  }

  setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'configure_gemini_token',
          description: 'Configure your Gemini API token for nano-banana image generation',
          inputSchema: {
            type: 'object',
            properties: {
              apiKey: {
                type: 'string',
                description: 'Your Gemini API key from Google AI Studio',
              },
            },
            required: ['apiKey'],
          },
        },
        {
          name: 'generate_image',
          description: 'Generate a new image from a text prompt.',
          inputSchema: {
            type: 'object',
            properties: {
              prompt: {
                type: 'string',
                description: 'Text prompt describing the image to create',
              },
            },
            required: ['prompt'],
          },
        },
        {
          name: 'edit_image',
          description: 'Edit an existing image file, optionally with extra reference images.',
          inputSchema: {
            type: 'object',
            properties: {
              imagePath: {
                type: 'string',
                description: 'Full file path to the image to edit',
              },
              prompt: {
                type: 'string',
                description: 'Text describing the modifications',
              },
              referenceImages: {
                type: 'array',
                items: { type: 'string' },
                description: 'Optional list of extra reference image paths',
              },
            },
            required: ['imagePath', 'prompt'],
          },
        },
        {
          name: 'continue_editing',
          description: 'Continue editing the last generated or edited image in this session.',
          inputSchema: {
            type: 'object',
            properties: {
              prompt: {
                type: 'string',
                description: 'Text describing the next modification',
              },
              referenceImages: {
                type: 'array',
                items: { type: 'string' },
                description: 'Optional list of extra reference image paths',
              },
            },
            required: ['prompt'],
          },
        },
        {
          name: 'get_configuration_status',
          description: 'Check whether Nano Banana is configured.',
          inputSchema: {
            type: 'object',
            properties: {},
            additionalProperties: false,
          },
        },
        {
          name: 'get_last_image_info',
          description: 'Get information about the last generated or edited image in this session.',
          inputSchema: {
            type: 'object',
            properties: {},
            additionalProperties: false,
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        switch (request.params.name) {
          case 'configure_gemini_token':
            return await this.configureGeminiToken(request);
          case 'generate_image':
            return await this.generateImage(request);
          case 'edit_image':
            return await this.editImage(request);
          case 'continue_editing':
            return await this.continueEditing(request);
          case 'get_configuration_status':
            return await this.getConfigurationStatus();
          case 'get_last_image_info':
            return await this.getLastImageInfo();
          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
        }
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }
        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    });
  }

  requireConfigured() {
    if (!this.config || !this.genAI) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        'Gemini API token not configured. Use configure_gemini_token first.',
      );
    }
    return this.config;
  }

  async configureGeminiToken(request) {
    const apiKey = cleanString(request.params.arguments?.apiKey);
    const nextConfig = ConfigSchema.parse({
      geminiApiKey: apiKey,
      model: this.config?.model || resolveModel(process.env.NANO_BANANA_MODEL),
      baseUrl: this.config?.baseUrl || normalizeBaseUrl(process.env.GOOGLE_GEMINI_BASE_URL) || undefined,
      apiVersion: this.config?.apiVersion || cleanString(process.env.GOOGLE_GEMINI_API_VERSION) || undefined,
    });
    this.config = nextConfig;
    this.genAI = buildGenAiClient(nextConfig);
    this.configSource = 'config_file';
    await this.saveConfig();
    return {
      content: [
        {
          type: 'text',
          text: `Nano Banana configured. Current model: ${nextConfig.model || DEFAULT_MODEL}`,
        },
      ],
    };
  }

  async generateImage(request) {
    const config = this.requireConfigured();
    const prompt = cleanString(request.params.arguments?.prompt);
    if (!prompt) {
      throw new McpError(ErrorCode.InvalidParams, 'prompt is required');
    }
    try {
      const response = await this.genAI.models.generateContent({
        model: config.model,
        contents: prompt,
      });
      return await this.buildImageResponse({
        response,
        prompt,
        outputPrefix: 'generated',
        summaryTitle: `Image generated with nano-banana (${config.model})`,
      });
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to generate image with model ${config.model}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async editImage(request) {
    const config = this.requireConfigured();
    const imagePath = cleanString(request.params.arguments?.imagePath);
    const prompt = cleanString(request.params.arguments?.prompt);
    const referenceImages = Array.isArray(request.params.arguments?.referenceImages)
      ? request.params.arguments.referenceImages.map((item) => cleanString(item)).filter(Boolean)
      : [];
    if (!imagePath || !prompt) {
      throw new McpError(ErrorCode.InvalidParams, 'imagePath and prompt are required');
    }
    try {
      const imageParts = [await this.readImagePart(imagePath)];
      for (const refPath of referenceImages) {
        try {
          imageParts.push(await this.readImagePart(refPath));
        } catch {}
      }
      imageParts.push({ text: prompt });
      const response = await this.genAI.models.generateContent({
        model: config.model,
        contents: [{ parts: imageParts }],
      });
      return await this.buildImageResponse({
        response,
        prompt,
        outputPrefix: 'edited',
        summaryTitle: `Image edited with nano-banana (${config.model})`,
        originalPath: imagePath,
        referenceImages,
      });
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to edit image with model ${config.model}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async continueEditing(request) {
    if (!this.lastImagePath) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        'No previous image found. Please generate or edit an image first.',
      );
    }
    try {
      await fs.access(this.lastImagePath);
    } catch {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Last image file not found at: ${this.lastImagePath}`,
      );
    }
    return this.editImage({
      method: 'tools/call',
      params: {
        name: 'edit_image',
        arguments: {
          imagePath: this.lastImagePath,
          prompt: request.params.arguments?.prompt,
          referenceImages: request.params.arguments?.referenceImages,
        },
      },
    });
  }

  async getConfigurationStatus() {
    if (!this.config || !this.genAI) {
      return {
        content: [
          {
            type: 'text',
            text:
              'Nano Banana is not configured.\n\n' +
              'Required: GEMINI_API_KEY\n' +
              `Optional: NANO_BANANA_MODEL (default: ${DEFAULT_MODEL})\n` +
              'Optional: GOOGLE_GEMINI_BASE_URL\n' +
              'Optional: GOOGLE_GEMINI_API_VERSION',
          },
        ],
      };
    }
    const lines = [
      'Nano Banana is configured.',
      `Source: ${this.configSource}`,
      `Model: ${this.config.model}`,
    ];
    if (this.config.baseUrl) {
      lines.push(`Base URL: ${this.config.baseUrl}`);
    }
    if (this.config.apiVersion) {
      lines.push(`API Version: ${this.config.apiVersion}`);
    }
    return {
      content: [{ type: 'text', text: lines.join('\n') }],
    };
  }

  async getLastImageInfo() {
    if (!this.lastImagePath) {
      return {
        content: [
          {
            type: 'text',
            text: 'No previous image found. Generate or edit an image first.',
          },
        ],
      };
    }
    try {
      const stats = await fs.stat(this.lastImagePath);
      return {
        content: [
          {
            type: 'text',
            text:
              `Path: ${this.lastImagePath}\n` +
              `File Size: ${Math.round(stats.size / 1024)} KB\n` +
              `Last Modified: ${stats.mtime.toLocaleString()}`,
          },
        ],
      };
    } catch {
      return {
        content: [
          {
            type: 'text',
            text: `Last image file not found: ${this.lastImagePath}`,
          },
        ],
      };
    }
  }

  async buildImageResponse({ response, prompt, outputPrefix, summaryTitle, originalPath = null, referenceImages = [] }) {
    const content = [];
    const savedFiles = [];
    let textContent = '';
    const imagesDir = this.getImagesDirectory();
    await fs.mkdir(imagesDir, { recursive: true, mode: 0o755 });
    const parts = response?.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part?.text) {
        textContent += part.text;
      }
      const inlineData = part?.inlineData;
      if (!inlineData?.data) {
        continue;
      }
      const fileName = `${outputPrefix}-${new Date().toISOString().replace(/[:.]/g, '-')}-${Math.random().toString(36).slice(2, 8)}.png`;
      const filePath = path.join(imagesDir, fileName);
      await fs.writeFile(filePath, Buffer.from(inlineData.data, 'base64'));
      savedFiles.push(filePath);
      this.lastImagePath = filePath;
      content.push({
        type: 'image',
        data: inlineData.data,
        mimeType: inlineData.mimeType || 'image/png',
      });
    }

    const lines = [summaryTitle, '', `Prompt: "${prompt}"`];
    if (originalPath) {
      lines.push(`Original: ${originalPath}`);
    }
    if (referenceImages.length > 0) {
      lines.push('', 'Reference images:', ...referenceImages.map((item) => `- ${item}`));
    }
    if (textContent) {
      lines.push('', `Description: ${textContent}`);
    }
    if (savedFiles.length > 0) {
      lines.push('', 'Saved files:', ...savedFiles.map((item) => `- ${item}`));
    } else {
      lines.push('', 'No image binary was returned by the model.');
    }
    content.unshift({ type: 'text', text: lines.join('\n') });
    return { content };
  }

  async readImagePart(filePath) {
    const buffer = await fs.readFile(filePath);
    return {
      inlineData: {
        data: buffer.toString('base64'),
        mimeType: this.getMimeType(filePath),
      },
    };
  }

  getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
      case '.jpg':
      case '.jpeg':
        return 'image/jpeg';
      case '.png':
        return 'image/png';
      case '.webp':
        return 'image/webp';
      default:
        return 'image/jpeg';
    }
  }

  getImagesDirectory() {
    if (os.platform() === 'win32') {
      return path.join(os.homedir(), 'Documents', 'nano-banana-images');
    }
    const cwd = process.cwd();
    if (cwd.startsWith('/usr/') || cwd.startsWith('/opt/') || cwd.startsWith('/var/')) {
      return path.join(os.homedir(), 'nano-banana-images');
    }
    return path.join(cwd, 'generated_imgs');
  }

  async saveConfig() {
    if (!this.config) return;
    const configPath = path.join(process.cwd(), DEFAULT_CONFIG_FILE);
    await fs.writeFile(configPath, `${JSON.stringify(this.config, null, 2)}\n`, 'utf8');
  }

  async loadConfig() {
    const envConfig = this.readEnvConfig();
    if (envConfig) {
      this.config = envConfig;
      this.genAI = buildGenAiClient(envConfig);
      this.configSource = 'environment';
      return;
    }

    try {
      const configPath = path.join(process.cwd(), DEFAULT_CONFIG_FILE);
      const raw = await fs.readFile(configPath, 'utf8');
      const parsed = JSON.parse(raw);
      const fileConfig = ConfigSchema.parse({
        geminiApiKey: parsed.geminiApiKey,
        model: resolveModel(parsed.model),
        baseUrl: normalizeBaseUrl(parsed.baseUrl) || undefined,
        apiVersion: cleanString(parsed.apiVersion) || undefined,
      });
      this.config = fileConfig;
      this.genAI = buildGenAiClient(fileConfig);
      this.configSource = 'config_file';
    } catch {
      this.configSource = 'not_configured';
    }
  }

  readEnvConfig() {
    const apiKey = cleanString(process.env.GEMINI_API_KEY) || cleanString(process.env.GOOGLE_API_KEY);
    if (!apiKey) {
      return null;
    }
    return ConfigSchema.parse({
      geminiApiKey: apiKey,
      model: resolveModel(process.env.NANO_BANANA_MODEL),
      baseUrl: normalizeBaseUrl(process.env.GOOGLE_GEMINI_BASE_URL) || undefined,
      apiVersion: cleanString(process.env.GOOGLE_GEMINI_API_VERSION) || undefined,
    });
  }

  async run() {
    await this.loadConfig();
    await this.server.connect(new StdioServerTransport());
  }
}

const server = new NanoBananaMcpServer();
server.run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
