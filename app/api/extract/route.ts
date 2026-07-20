import { openrouterExtractPdf, resolveConfig } from "@/lib/llm"

/** ~20 MB PDF → ~27 MB base64. */
const MAX_BASE64_LENGTH = 28_000_000

interface ExtractRequest {
  filename?: string
  data?: string
  provider?: string
  model?: string
}

/**
 * LLM-based document extraction: turns an uploaded PDF into markdown that
 * the /api/autofill endpoint can consume. Runs via OpenRouter's file input
 * (parser engine configurable through RODEOS_PDF_ENGINE).
 */
export async function POST(request: Request) {
  let body: ExtractRequest
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { filename = "document.pdf", data } = body
  if (!data) {
    return Response.json(
      { error: "Field 'data' (base64-encoded PDF) is required" },
      { status: 400 }
    )
  }
  if (data.length > MAX_BASE64_LENGTH) {
    return Response.json(
      { error: "PDF too large — please keep it below 20 MB" },
      { status: 413 }
    )
  }

  const config = resolveConfig(body.provider, body.model)
  if (config.provider !== "openrouter") {
    return Response.json(
      {
        error:
          "LLM-based PDF extraction currently runs via OpenRouter. Switch the provider to OpenRouter, or paste the document text / upload a .md or .txt file for fully local use.",
      },
      { status: 400 }
    )
  }

  try {
    const text = await openrouterExtractPdf(config.model, filename, data)
    return Response.json({
      text,
      filename,
      provider: config.provider,
      model: config.model,
    })
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    )
  }
}
