/**
 * Server-side LLM access. Providers are configured at runtime (see
 * lib/settings.ts and /settings) rather than compiled in — anything that
 * speaks the OpenAI protocol works: the IONOS AI Model Hub, OpenAI itself,
 * vLLM, LM Studio, an internal gateway. Two kinds get special treatment:
 *
 *  - "openrouter": OpenAI-compatible plus the headers and the file-parser
 *    plugin used for PDF extraction
 *  - "ollama": local inference over Ollama's own /api/chat protocol
 */

import {
  findProvider,
  type ProviderKind,
  type ProviderSettings,
} from "@/lib/settings"

export interface LlmConfig {
  providerId: string
  label: string
  kind: ProviderKind
  baseUrl: string
  apiKey?: string
  model: string
}

export interface ChatMessage {
  role: "system" | "user" | "assistant"
  content: string
}

/**
 * Resolve the provider requested by the UI (falling back to the configured
 * default) and the model to use with it.
 */
export async function resolveConfig(
  providerId?: string | null,
  model?: string | null
): Promise<LlmConfig> {
  const provider = await findProvider(providerId)
  if (!provider) {
    throw new Error(
      "No LLM provider is configured. Add one under Settings in the app."
    )
  }
  return toConfig(provider, model?.trim() || provider.model)
}

export function toConfig(provider: ProviderSettings, model: string): LlmConfig {
  return {
    providerId: provider.id,
    label: provider.label,
    kind: provider.kind,
    baseUrl: provider.baseUrl.replace(/\/$/, ""),
    apiKey: provider.apiKey,
    model,
  }
}

export async function chatCompletion(
  config: LlmConfig,
  messages: ChatMessage[]
): Promise<string> {
  if (config.kind === "ollama") return ollamaChat(config, messages)
  return openAiChat(config, { model: config.model, messages, temperature: 0.1 })
}

/* ------------------------------------------------------------------ */
/* OpenAI-compatible providers                                         */
/* ------------------------------------------------------------------ */

function requireEndpoint(config: LlmConfig): void {
  if (!config.baseUrl) {
    throw new Error(
      `No endpoint URL configured for "${config.label}". Add it under Settings.`
    )
  }
  if (!config.apiKey) {
    throw new Error(
      `No API key configured for "${config.label}". Add it under Settings, or switch to a local provider.`
    )
  }
  if (!config.model) {
    throw new Error(
      `No model configured for "${config.label}". Enter a model id under Settings.`
    )
  }
}

function openAiHeaders(config: LlmConfig): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.apiKey}`,
    "Content-Type": "application/json",
  }
  if (config.kind === "openrouter") {
    headers["HTTP-Referer"] =
      "https://github.com/dlr/rox-rodeos-dlr-dataspace-integration"
    headers["X-Title"] = "RODEOS Semantic Model Generator"
  }
  return headers
}

/**
 * POST to {baseUrl}/chat/completions. Used for every OpenAI-compatible
 * provider — the body may carry provider-specific extras (OpenRouter's
 * file-parser plugin, for instance).
 */
async function openAiRequest(
  config: LlmConfig,
  body: Record<string, unknown>
): Promise<string> {
  requireEndpoint(config)

  let res: Response
  try {
    res = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: openAiHeaders(config),
      body: JSON.stringify(body),
    })
  } catch (err) {
    throw new Error(
      `Cannot reach ${config.label} at ${config.baseUrl}: ${
        err instanceof Error ? err.message : String(err)
      }`
    )
  }

  if (!res.ok) {
    const errBody = await res.text()
    throw new Error(
      `${config.label} error ${res.status}: ${errBody.slice(0, 500)}`
    )
  }

  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content
  if (typeof content !== "string") {
    throw new Error(`${config.label} returned an unexpected response shape`)
  }
  return content
}

async function openAiChat(
  config: LlmConfig,
  body: Record<string, unknown>
): Promise<string> {
  return openAiRequest(config, body)
}

/**
 * Extract the text content of a PDF as clean markdown, LLM-based via
 * OpenRouter's file input. The parsing engine (default: mistral-ocr, the
 * same OCR the original RODEOS Python pipeline used; alternative:
 * "pdf-text" for born-digital PDFs at no parsing cost) is configurable via
 * RODEOS_PDF_ENGINE.
 */
export async function extractPdf(
  config: LlmConfig,
  filename: string,
  base64Data: string
): Promise<string> {
  const engine = process.env.RODEOS_PDF_ENGINE || "mistral-ocr"
  return openAiRequest(config, {
    model: config.model,
    temperature: 0.1,
    plugins: [{ id: "file-parser", pdf: { engine } }],
    messages: [
      {
        role: "system",
        content:
          "You convert technical PDF documents (datasheets, manuals, service descriptions) into clean, complete markdown. Preserve all technical specifications, tables, units and identifiers exactly. Output only the markdown content, no commentary.",
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Convert this document to markdown. Keep every technical detail.",
          },
          {
            type: "file",
            file: {
              filename,
              file_data: `data:application/pdf;base64,${base64Data}`,
            },
          },
        ],
      },
    ],
  })
}

/* ------------------------------------------------------------------ */
/* Ollama                                                              */
/* ------------------------------------------------------------------ */

async function ollamaChat(
  config: LlmConfig,
  messages: ChatMessage[]
): Promise<string> {
  const base = config.baseUrl || "http://localhost:11434"
  let res: Response
  try {
    res = await fetch(`${base}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: config.model,
        messages,
        stream: false,
        options: { temperature: 0.1 },
      }),
    })
  } catch {
    throw new Error(`Cannot reach Ollama at ${base}. Is "ollama serve" running?`)
  }

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Ollama error ${res.status}: ${body.slice(0, 500)}`)
  }

  const data = await res.json()
  const content = data?.message?.content
  if (typeof content !== "string") {
    throw new Error("Ollama returned an unexpected response shape")
  }
  return content
}

/* ------------------------------------------------------------------ */
/* Connection test                                                     */
/* ------------------------------------------------------------------ */

export interface ProviderProbe {
  ok: boolean
  message: string
  /** Model ids the endpoint reports, when it offers a listing. */
  models: string[]
}

/**
 * Verify that a provider is reachable and list the models it offers, so a
 * user configuring an endpoint can see it works before running an autofill.
 */
export async function probeProvider(config: LlmConfig): Promise<ProviderProbe> {
  const base = config.baseUrl.replace(/\/$/, "")
  if (!base) {
    return { ok: false, message: "No endpoint URL configured.", models: [] }
  }

  const url = config.kind === "ollama" ? `${base}/api/tags` : `${base}/models`
  let res: Response
  try {
    res = await fetch(url, {
      headers: config.apiKey
        ? { Authorization: `Bearer ${config.apiKey}` }
        : undefined,
    })
  } catch (err) {
    return {
      ok: false,
      message: `Cannot reach ${url}: ${
        err instanceof Error ? err.message : String(err)
      }`,
      models: [],
    }
  }

  if (!res.ok) {
    const body = await res.text()
    return {
      ok: false,
      message: `${url} answered ${res.status}: ${body.slice(0, 200)}`,
      models: [],
    }
  }

  let models: string[] = []
  try {
    const data = await res.json()
    const raw = config.kind === "ollama" ? data?.models : data?.data
    if (Array.isArray(raw)) {
      models = raw
        .map((entry: { id?: string; name?: string }) => entry?.id ?? entry?.name)
        .filter((id: unknown): id is string => typeof id === "string")
        .sort()
    }
  } catch {
    // Reachable but not a model listing — still a successful connection.
  }

  return {
    ok: true,
    message: models.length
      ? `Connected — ${models.length} model${models.length === 1 ? "" : "s"} available.`
      : "Connected.",
    models,
  }
}

/* ------------------------------------------------------------------ */
/* Response parsing                                                    */
/* ------------------------------------------------------------------ */

/**
 * Extract the first JSON object from an LLM response: strips <think> blocks
 * and code fences, then parses from the first "{" to the last "}".
 */
export function extractJson(text: string): unknown {
  const cleaned = text
    .replace(/<think>[\s\S]*?<\/think>/g, "")
    .replace(/```(?:json)?/g, "")
    .trim()
  const start = cleaned.indexOf("{")
  const end = cleaned.lastIndexOf("}")
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON object found in model response")
  }
  return JSON.parse(cleaned.slice(start, end + 1))
}
