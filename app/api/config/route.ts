import { DEFAULT_DATASPACE_API_URL } from "@/lib/dataspace"
import { loadSettings, settingsLocked, toPublicProvider } from "@/lib/settings"

// Reads the runtime settings file, so it must not be prerendered.
export const dynamic = "force-dynamic"

export async function GET() {
  const settings = await loadSettings()
  return Response.json({
    providers: settings.providers.map(toPublicProvider),
    defaultProviderId: settings.defaultProviderId,
    settingsLocked: settingsLocked(),
    // Defaults the connection panel prefills. There is deliberately nothing
    // about the API key here — it is never served and never read from the
    // environment, so every session states its own.
    dataspace: {
      apiUrl: process.env.DATASPACE_API_URL?.trim() || DEFAULT_DATASPACE_API_URL,
      connector: process.env.DATASPACE_CONNECTOR?.trim() || "",
    },
  })
}
