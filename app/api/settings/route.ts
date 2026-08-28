import {
  loadSettings,
  PROVIDER_PRESETS,
  saveSettings,
  settingsLocked,
  settingsPath,
  slugify,
  toPublicProvider,
  type ProviderKind,
  type ProviderSettings,
} from "@/lib/settings"

// The settings file is read on every request — a prerendered answer would
// serve whatever was on disk at build time.
export const dynamic = "force-dynamic"

/**
 * LLM provider configuration for the UI. API keys never leave the server:
 * the response only reports whether a key is stored and its last four
 * characters.
 *
 * Note that this endpoint is unauthenticated, like the rest of the app —
 * anyone who can reach the app can change its provider configuration. Set
 * RODEOS_SETTINGS_LOCKED=true when hosting it beyond a trusted network.
 */
export async function GET() {
  const settings = await loadSettings()
  return Response.json({
    providers: settings.providers.map(toPublicProvider),
    defaultProviderId: settings.defaultProviderId,
    locked: settingsLocked(),
    settingsPath: settingsPath(),
    presets: PROVIDER_PRESETS,
  })
}

interface IncomingProvider {
  id?: string
  label?: string
  kind?: string
  baseUrl?: string
  /** Omitted → keep the stored key. Empty string → delete it. */
  apiKey?: string | null
  model?: string
}

interface PutBody {
  providers?: IncomingProvider[]
  defaultProviderId?: string
}

export async function PUT(request: Request) {
  if (settingsLocked()) {
    return Response.json(
      {
        error:
          "Settings are locked (RODEOS_SETTINGS_LOCKED=true). Configure the providers through the server environment instead.",
      },
      { status: 403 }
    )
  }

  let body: PutBody
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (!Array.isArray(body.providers)) {
    return Response.json(
      { error: "Field 'providers' must be an array" },
      { status: 400 }
    )
  }

  const current = await loadSettings()
  const currentById = new Map(current.providers.map((p) => [p.id, p]))

  const providers: ProviderSettings[] = []
  const seen = new Set<string>()
  for (const entry of body.providers) {
    const label = String(entry.label ?? "").trim()
    if (!label) {
      return Response.json(
        { error: "Every provider needs a name" },
        { status: 400 }
      )
    }
    let id = slugify(String(entry.id ?? label))
    // Ids identify the provider on the wire — keep them unique.
    let suffix = 2
    while (seen.has(id)) id = `${slugify(String(entry.id ?? label))}-${suffix++}`
    seen.add(id)

    const existing = currentById.get(id)
    const kind: ProviderKind =
      entry.kind === "ollama" || entry.kind === "openrouter"
        ? entry.kind
        : "openai"
    const baseUrl = String(entry.baseUrl ?? "").trim()
    if (!baseUrl) {
      return Response.json(
        { error: `Provider "${label}" needs an endpoint URL` },
        { status: 400 }
      )
    }

    // apiKey semantics: undefined keeps, "" clears, a string replaces.
    const apiKey =
      entry.apiKey === undefined || entry.apiKey === null
        ? existing?.apiKey
        : String(entry.apiKey).trim() || undefined

    providers.push({
      id,
      label,
      kind,
      baseUrl,
      apiKey,
      model: String(entry.model ?? "").trim(),
      builtin: existing?.builtin,
    })
  }

  const defaultProviderId =
    body.defaultProviderId && providers.some((p) => p.id === body.defaultProviderId)
      ? body.defaultProviderId
      : (providers[0]?.id ?? current.defaultProviderId)

  try {
    await saveSettings({ providers, defaultProviderId })
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }

  const saved = await loadSettings()
  return Response.json({
    providers: saved.providers.map(toPublicProvider),
    defaultProviderId: saved.defaultProviderId,
    locked: false,
    settingsPath: settingsPath(),
    presets: PROVIDER_PRESETS,
  })
}
