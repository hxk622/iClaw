import fs from 'node:fs/promises';

const CONFIG_PATH = 'services/openclaw/resources/config/portal-app-runtime.json';
const DEFAULT_MODEL = process.env.ICLAW_MODEL || 'qwen3.5-plus';
const DEFAULT_PROMPT = process.env.ICLAW_PROMPT || '北京天气怎么样';

function extractQuotedValue(source, key) {
  const pattern = new RegExp(`"${key}"\\s*:\\s*"([^"\\\\]*(?:\\\\.[^"\\\\]*)*)"`, 'm');
  const match = source.match(pattern);
  return match ? JSON.parse(`"${match[1]}"`) : null;
}

function truncate(value, max = 1200) {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max)}...<truncated ${value.length - max} chars>`;
}

function summarizeUsageObject(value) {
  if (!value || typeof value !== 'object') {
    return null;
  }
  return {
    prompt_tokens: value.prompt_tokens ?? null,
    completion_tokens: value.completion_tokens ?? null,
    total_tokens: value.total_tokens ?? null,
    prompt_tokens_details: value.prompt_tokens_details ?? null,
    completion_tokens_details: value.completion_tokens_details ?? null,
    input_tokens: value.input_tokens ?? null,
    output_tokens: value.output_tokens ?? null,
  };
}

async function readConfig() {
  const raw = await fs.readFile(CONFIG_PATH, 'utf8');
  const baseUrl = extractQuotedValue(raw, 'base_url');
  const apiKey = extractQuotedValue(raw, 'api_key');
  if (!baseUrl || !apiKey) {
    throw new Error(`Failed to extract base_url/api_key from ${CONFIG_PATH}`);
  }
  return {baseUrl, apiKey};
}

async function callNonStream({baseUrl, apiKey, model, prompt}) {
  const payload = {
    model,
    stream: false,
    messages: [{role: 'user', content: prompt}],
  };
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return {
    status: res.status,
    ok: res.ok,
    usage: summarizeUsageObject(json?.usage),
    firstChoiceFinishReason: json?.choices?.[0]?.finish_reason ?? null,
    body: truncate(text),
  };
}

async function callStream({baseUrl, apiKey, model, prompt}) {
  const payload = {
    model,
    stream: true,
    stream_options: {include_usage: true},
    messages: [{role: 'user', content: prompt}],
  };
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const dataLines = lines
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim())
    .filter((line) => line && line !== '[DONE]');
  const parsed = dataLines
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return {__parseError: line};
      }
    });
  const usageChunks = parsed
    .map((entry) => summarizeUsageObject(entry?.usage || entry?.choices?.[0]?.usage || null))
    .filter(Boolean);
  return {
    status: res.status,
    ok: res.ok,
    usageChunkCount: usageChunks.length,
    usageChunks,
    bodyPreview: truncate(text, 2400),
  };
}

async function callToolRoundTrip({baseUrl, apiKey, model}) {
  const toolPayload = {
    model,
    stream: true,
    stream_options: {include_usage: true},
    messages: [{role: 'user', content: '请调用 get_weather 工具查询北京天气'}],
    tools: [
      {
        type: 'function',
        function: {
          name: 'get_weather',
          description: 'Get current weather',
          parameters: {
            type: 'object',
            properties: {
              city: {
                type: 'string',
              },
            },
            required: ['city'],
          },
        },
      },
    ],
  };

  const firstRes = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(toolPayload),
  });
  const firstText = await firstRes.text();
  const firstDataLines = firstText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim())
    .filter((line) => line && line !== '[DONE]');
  const firstChunks = firstDataLines.map((line) => {
    try {
      return JSON.parse(line);
    } catch {
      return {__parseError: line};
    }
  });
  const firstUsageChunks = firstChunks
    .map((entry) => summarizeUsageObject(entry?.usage || entry?.choices?.[0]?.usage || null))
    .filter(Boolean);

  let toolCallId = null;
  let toolCallName = null;
  let toolArguments = '';
  let finishReason = null;
  for (const chunk of firstChunks) {
    const choice = chunk?.choices?.[0];
    if (choice?.finish_reason) {
      finishReason = choice.finish_reason;
    }
    const toolCalls = choice?.delta?.tool_calls;
    if (!Array.isArray(toolCalls)) {
      continue;
    }
    for (const toolCall of toolCalls) {
      if (toolCall?.id) {
        toolCallId = toolCall.id;
      }
      if (toolCall?.function?.name) {
        toolCallName = toolCall.function.name;
      }
      if (toolCall?.function?.arguments) {
        toolArguments += toolCall.function.arguments;
      }
    }
  }

  if (!toolCallId || !toolCallName) {
    return {
      first: {
        status: firstRes.status,
        ok: firstRes.ok,
        finishReason,
        usageChunkCount: firstUsageChunks.length,
        usageChunks: firstUsageChunks,
        bodyPreview: truncate(firstText, 2400),
      },
      second: null,
    };
  }

  const secondPayload = {
    model,
    stream: true,
    stream_options: {include_usage: true},
    messages: [
      {role: 'user', content: '请调用 get_weather 工具查询北京天气'},
      {
        role: 'assistant',
        content: null,
        tool_calls: [
          {
            id: toolCallId,
            type: 'function',
            function: {
              name: toolCallName,
              arguments: toolArguments,
            },
          },
        ],
      },
      {
        role: 'tool',
        tool_call_id: toolCallId,
        content: '北京当前晴，10°C，体感 8°C',
      },
    ],
    tools: toolPayload.tools,
  };

  const secondRes = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(secondPayload),
  });
  const secondText = await secondRes.text();
  const secondDataLines = secondText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim())
    .filter((line) => line && line !== '[DONE]');
  const secondChunks = secondDataLines.map((line) => {
    try {
      return JSON.parse(line);
    } catch {
      return {__parseError: line};
    }
  });
  const secondUsageChunks = secondChunks
    .map((entry) => summarizeUsageObject(entry?.usage || entry?.choices?.[0]?.usage || null))
    .filter(Boolean);

  return {
    first: {
      status: firstRes.status,
      ok: firstRes.ok,
      finishReason,
      toolCallId,
      toolCallName,
      toolArguments,
      usageChunkCount: firstUsageChunks.length,
      usageChunks: firstUsageChunks,
      bodyPreview: truncate(firstText, 2400),
    },
    second: {
      status: secondRes.status,
      ok: secondRes.ok,
      usageChunkCount: secondUsageChunks.length,
      usageChunks: secondUsageChunks,
      bodyPreview: truncate(secondText, 2400),
    },
  };
}

const {baseUrl, apiKey} = await readConfig();
const nonStream = await callNonStream({
  baseUrl,
  apiKey,
  model: DEFAULT_MODEL,
  prompt: DEFAULT_PROMPT,
});
const stream = await callStream({
  baseUrl,
  apiKey,
  model: DEFAULT_MODEL,
  prompt: DEFAULT_PROMPT,
});
const toolRoundTrip = await callToolRoundTrip({
  baseUrl,
  apiKey,
  model: DEFAULT_MODEL,
});

console.log(
  JSON.stringify(
    {
      model: DEFAULT_MODEL,
      nonStream,
      stream,
      toolRoundTrip,
    },
    null,
    2,
  ),
);
