/**
 * Server-side LLM access. Two providers are supported:
 *
 *  - "openrouter" (default): any OpenRouter model, key + default model from .env
 *  - "ollama": fully local inference against an Ollama server
 *
 * The provider/model can be overridden per request from the UI; the .env
 * values define the reference configuration.
 */

export type LlmProvider = "openrouter" | "ollama"

export interface LlmConfig {
  provider: LlmProvider
  model: string
}

export interface ChatMessage {
  role: "system" | "user" | "assistant"
  content: string
}

export const DEFAULTS = {
  provider: (process.env.RODEOS_LLM_PROVIDER === "ollama"
    ? "ollama"
    : "openrouter") as LlmProvider,
  openrouterModel: process.env.RODEOS_DEFAULT_MODEL || "openai/gpt-4o-mini",
  ollamaModel: process.env.RODEOS_LOCAL_MODEL || "qwen2.5:3b",
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
}

export function resolveConfig(
  provider?: string | null,
  model?: string | null
): LlmConfig {
  const p: LlmProvider = provider === "ollama" || provider === "openrouter"
    ? provider
    : DEFAULTS.provider
  const m =
    model?.trim() ||
    (p === "ollama" ? DEFAULTS.ollamaModel : DEFAULTS.openrouterModel)
  return { provider: p, model: m }
}

export async function chatCompletion(
  config: LlmConfig,
  messages: ChatMessage[]
): Promise<string> {
  if (config.provider === "ollama") {
    return ollamaChat(config.model, messages)
  }
  return openrouterChat(config.model, messages)
}

async function openrouterRequest(body: Record<string, unknown>): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    throw new Error(
      "OPENROUTER_API_KEY is not set. Add it to the .env file in the project root or switch the provider to Ollama."
    )
  }

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://github.com/dlr/rox-rodeos-dlr-dataspace-integration",
      "X-Title": "RODEOS Semantic Model Generator",
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errBody = await res.text()
    throw new Error(`OpenRouter error ${res.status}: ${errBody.slice(0, 500)}`)
  }

  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content
  if (typeof content !== "string") {
    throw new Error("OpenRouter returned an unexpected response shape")
  }
  return content
}

async function openrouterChat(
  model: string,
  messages: ChatMessage[]
): Promise<string> {
  return openrouterRequest({ model, messages, temperature: 0.1 })
}

/**
 * Extract the text content of a PDF as clean markdown, LLM-based via
 * OpenRouter's file input. The parsing engine (default: mistral-ocr, the
 * same OCR the original RODEOS Python pipeline used; alternative:
 * "pdf-text" for born-digital PDFs at no parsing cost) is configurable via
 * RODEOS_PDF_ENGINE.
 */
export async function openrouterExtractPdf(
  model: string,
  filename: string,
  base64Data: string
): Promise<string> {
  const engine = process.env.RODEOS_PDF_ENGINE || "mistral-ocr"
  return openrouterRequest({
    model,
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

async function ollamaChat(
  model: string,
  messages: ChatMessage[]
): Promise<string> {
  const base = DEFAULTS.ollamaBaseUrl.replace(/\/$/, "")
  let res: Response
  try {
    res = await fetch(`${base}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        options: { temperature: 0.1 },
      }),
    })
  } catch {
    throw new Error(
      `Cannot reach Ollama at ${base}. Is "ollama serve" running?`
    )
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
