import { probeProvider, toConfig } from "@/lib/llm"
import { findProvider, type ProviderKind } from "@/lib/settings"

export const dynamic = "force-dynamic"

interface TestBody {
  /** Existing provider to test — its stored key is used. */
  id?: string
  /** Or an unsaved draft from the settings form. */
  kind?: string
  baseUrl?: string
  apiKey?: string
  model?: string
}

/**
 * Check whether a provider endpoint answers, and report the models it
 * offers. Lets the user verify an endpoint (and find its model ids) before
 * relying on it for an autofill run.
 */
export async function POST(request: Request) {
  let body: TestBody
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const stored = body.id ? await findProvider(body.id) : null
  const kind: ProviderKind =
    body.kind === "ollama" || body.kind === "openrouter"
      ? body.kind
      : body.kind === "openai"
        ? "openai"
        : (stored?.kind ?? "openai")

  const baseUrl = (body.baseUrl ?? stored?.baseUrl ?? "").trim()
  // An empty key in the draft means "use the one already stored" — the form
  // never receives the secret it would otherwise have to send back.
  const apiKey = body.apiKey?.trim() || stored?.apiKey
  const model = (body.model ?? stored?.model ?? "").trim()

  const probe = await probeProvider(
    toConfig(
      {
        id: stored?.id ?? "draft",
        label: stored?.label ?? "This provider",
        kind,
        baseUrl,
        apiKey,
        model,
      },
      model
    )
  )

  return Response.json(probe)
}
