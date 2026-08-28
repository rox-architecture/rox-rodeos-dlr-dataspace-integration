import { getDataspaceConfig } from "@/lib/dataspace"
import { loadSettings, settingsLocked, toPublicProvider } from "@/lib/settings"

// Reads the runtime settings file, so it must not be prerendered.
export const dynamic = "force-dynamic"

export async function GET() {
  const dataspace = getDataspaceConfig()
  const settings = await loadSettings()
  return Response.json({
    providers: settings.providers.map(toPublicProvider),
    defaultProviderId: settings.defaultProviderId,
    settingsLocked: settingsLocked(),
    dataspaceConfigured: Boolean(dataspace),
    dataspaceConnector: dataspace?.connector ?? null,
  })
}
