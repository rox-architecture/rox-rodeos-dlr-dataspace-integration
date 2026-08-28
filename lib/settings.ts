/**
 * Runtime configuration of the LLM providers, editable from the UI.
 *
 * The .env file defines the reference setup; whoever hosts the app can add,
 * edit or remove providers at runtime under /settings without touching the
 * environment or restarting. Settings are stored server-side (default:
 * data/settings.json) so an API key never has to reach the browser — the
 * API only ever reports whether a key exists, plus its last four characters.
 *
 * Set RODEOS_SETTINGS_LOCKED=true on a shared deployment to keep the UI
 * read-only and pin the configuration to the environment.
 */

import { promises as fs } from "node:fs"
import path from "node:path"

/**
 * How the provider is talked to:
 *  - "openai"     any OpenAI-compatible /v1 endpoint (IONOS AI Model Hub,
 *                 OpenAI, vLLM, LM Studio, Together, …)
 *  - "openrouter" OpenAI-compatible plus the headers and the file-parser
 *                 plugin used for PDF extraction
 *  - "ollama"     local Ollama server (its own /api/chat protocol)
 */
export type ProviderKind = "openai" | "openrouter" | "ollama"

export interface ProviderSettings {
  /** Stable slug used as the wire identifier. */
  id: string
  label: string
  kind: ProviderKind
  /** Base URL including the version segment, e.g. https://host/v1 */
  baseUrl: string
  apiKey?: string
  /** Default model id for this provider. */
  model: string
  /**
   * Defined by the environment. Built-ins can be edited and hidden but not
   * deleted — they come back from .env on the next start.
   */
  builtin?: boolean
}

export interface Settings {
  providers: ProviderSettings[]
  defaultProviderId: string
}

/** Provider without its secret, safe to send to the browser. */
export type PublicProvider = Omit<ProviderSettings, "apiKey"> & {
  hasApiKey: boolean
  /** Last four characters, for recognising which key is stored. */
  apiKeyHint: string | null
  /** True when the key comes from .env rather than the settings file. */
  apiKeyFromEnv: boolean
}

export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"

/**
 * Ready-made endpoints offered in the UI. IONOS AI Model Hub speaks the
 * OpenAI protocol; its base URL must end in /v1.
 */
export const PROVIDER_PRESETS: Array<{
  label: string
  kind: ProviderKind
  baseUrl: string
  hint: string
}> = [
  {
    label: "IONOS AI Model Hub",
    kind: "openai",
    baseUrl: "https://openai.inference.de-txl.ionos.com/v1",
    hint: "Token from the IONOS Cloud panel; model ids via “Test connection”.",
  },
  {
    label: "OpenAI",
    kind: "openai",
    baseUrl: "https://api.openai.com/v1",
    hint: "Key from platform.openai.com.",
  },
  {
    label: "OpenRouter",
    kind: "openrouter",
    baseUrl: OPENROUTER_BASE_URL,
    hint: "The only provider that can also extract text from PDFs.",
  },
  {
    label: "Ollama (local)",
    kind: "ollama",
    baseUrl: "http://localhost:11434",
    hint: "Requires a running “ollama serve”. No key needed.",
  },
  {
    label: "Other OpenAI-compatible endpoint",
    kind: "openai",
    baseUrl: "",
    hint: "vLLM, LM Studio, Together, Groq, an internal gateway …",
  },
]

/**
 * Where the settings live. Kept relative by default so the build's file
 * tracer does not resolve it against process.cwd() and pull the whole
 * project into the output; fs resolves it against the working directory of
 * the running server, which is what we want.
 */
export function settingsPath(): string {
  return process.env.RODEOS_SETTINGS_PATH || "data/settings.json"
}

export function settingsLocked(): boolean {
  return process.env.RODEOS_SETTINGS_LOCKED === "true"
}

/** The providers the environment defines — always present as a fallback. */
export function envProviders(): ProviderSettings[] {
  return [
    {
      id: "openrouter",
      label: "OpenRouter",
      kind: "openrouter",
      baseUrl: OPENROUTER_BASE_URL,
      apiKey: process.env.OPENROUTER_API_KEY || undefined,
      model: process.env.RODEOS_DEFAULT_MODEL || "openai/gpt-4o-mini",
      builtin: true,
    },
    {
      id: "ollama",
      label: "Ollama (local)",
      kind: "ollama",
      baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
      model: process.env.RODEOS_LOCAL_MODEL || "qwen2.5:3b",
      builtin: true,
    },
  ]
}

function envDefaultProviderId(): string {
  return process.env.RODEOS_LLM_PROVIDER === "ollama" ? "ollama" : "openrouter"
}

export function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "provider"
  )
}

interface StoredSettings {
  providers?: Partial<ProviderSettings>[]
  defaultProviderId?: string
}

async function readStored(): Promise<StoredSettings> {
  try {
    const raw = await fs.readFile(settingsPath(), "utf8")
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === "object" ? (parsed as StoredSettings) : {}
  } catch {
    // No settings file yet (or unreadable) — the environment defines everything.
    return {}
  }
}

function normalizeStored(entry: Partial<ProviderSettings>): ProviderSettings | null {
  const id = typeof entry.id === "string" ? slugify(entry.id) : ""
  if (!id) return null
  const kind: ProviderKind =
    entry.kind === "ollama" || entry.kind === "openrouter" ? entry.kind : "openai"
  return {
    id,
    label: typeof entry.label === "string" && entry.label ? entry.label : id,
    kind,
    baseUrl: typeof entry.baseUrl === "string" ? entry.baseUrl.trim() : "",
    apiKey: typeof entry.apiKey === "string" && entry.apiKey ? entry.apiKey : undefined,
    model: typeof entry.model === "string" ? entry.model.trim() : "",
    builtin: entry.builtin === true,
  }
}

/**
 * Effective settings: the environment's providers, overlaid with what was
 * saved from the UI. A stored entry with a built-in's id overrides it (and
 * keeps its builtin flag, so it cannot be deleted).
 */
export async function loadSettings(): Promise<Settings> {
  const stored = await readStored()
  const byId = new Map<string, ProviderSettings>()
  for (const provider of envProviders()) byId.set(provider.id, provider)

  for (const entry of stored.providers ?? []) {
    const normalized = normalizeStored(entry)
    if (!normalized) continue
    const existing = byId.get(normalized.id)
    byId.set(normalized.id, {
      ...normalized,
      // Never lose the env key when the UI saved the provider without one.
      apiKey: normalized.apiKey ?? existing?.apiKey,
      builtin: existing?.builtin ?? normalized.builtin,
    })
  }

  const providers = [...byId.values()]
  const wanted = stored.defaultProviderId ?? envDefaultProviderId()
  const defaultProviderId = providers.some((p) => p.id === wanted)
    ? wanted
    : (providers[0]?.id ?? "openrouter")

  return { providers, defaultProviderId }
}

/**
 * Persist the settings file. Keys that still equal the environment's are
 * dropped rather than written: .env stays the single place that holds them,
 * so rotating a key there takes effect and the secret is not copied into a
 * second file. loadSettings() folds them back in.
 */
export async function saveSettings(settings: Settings): Promise<void> {
  const target = settingsPath()
  const envKeys = new Map(envProviders().map((p) => [p.id, p.apiKey]))
  const providers = settings.providers.map((provider) =>
    provider.apiKey && envKeys.get(provider.id) === provider.apiKey
      ? { ...provider, apiKey: undefined }
      : provider
  )

  try {
    await fs.mkdir(path.dirname(target), { recursive: true })
    await fs.writeFile(
      target,
      `${JSON.stringify({ ...settings, providers }, null, 2)}\n`,
      "utf8"
    )
  } catch (err) {
    throw new Error(
      `Could not write the settings file at ${target}: ${
        err instanceof Error ? err.message : String(err)
      }`
    )
  }
}

export function toPublicProvider(provider: ProviderSettings): PublicProvider {
  const { apiKey, ...rest } = provider
  const fromEnv = envProviders().find((p) => p.id === provider.id)
  return {
    ...rest,
    hasApiKey: Boolean(apiKey),
    apiKeyHint: apiKey ? `…${apiKey.slice(-4)}` : null,
    apiKeyFromEnv: Boolean(apiKey && fromEnv?.apiKey === apiKey),
  }
}

export async function findProvider(
  id: string | null | undefined
): Promise<ProviderSettings | null> {
  const settings = await loadSettings()
  if (!id) {
    return (
      settings.providers.find((p) => p.id === settings.defaultProviderId) ??
      settings.providers[0] ??
      null
    )
  }
  return settings.providers.find((p) => p.id === id) ?? null
}
