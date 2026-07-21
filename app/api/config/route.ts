import { getDataspaceConfig } from "@/lib/dataspace"
import { DEFAULTS } from "@/lib/llm"

export async function GET() {
  const dataspace = getDataspaceConfig()
  return Response.json({
    provider: DEFAULTS.provider,
    openrouterModel: DEFAULTS.openrouterModel,
    ollamaModel: DEFAULTS.ollamaModel,
    ollamaBaseUrl: DEFAULTS.ollamaBaseUrl,
    hasOpenrouterKey: Boolean(process.env.OPENROUTER_API_KEY),
    dataspaceConfigured: Boolean(dataspace),
    dataspaceConnector: dataspace?.connector ?? null,
  })
}
