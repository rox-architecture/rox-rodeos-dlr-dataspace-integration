import { DEFAULT_DATASPACE_API_URL, getDataspaceConfig } from "@/lib/dataspace"
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
    // Defaults the connection panel prefills. The API key is deliberately not
    // among them — on a deployment that would hand the operator's key to every
    // visitor. Only its presence is reported, which is enough for the panel to
    // show the field as satisfied without the server having to reveal it.
    dataspace: {
      apiUrl: process.env.DATASPACE_API_URL?.trim() || DEFAULT_DATASPACE_API_URL,
      connector: process.env.DATASPACE_CONNECTOR?.trim() || "",
      hasApiKey: Boolean(process.env.DATASPACE_API_KEY?.trim()),
    },
  })
}
