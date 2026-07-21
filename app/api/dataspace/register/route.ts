import {
  createOffer,
  getConnectorInfo,
  getDataspaceConfig,
  resolvePolicies,
  uploadJsonFile,
} from "@/lib/dataspace"

interface RegisterRequest {
  instance?: Record<string, unknown>
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
}

/**
 * Registers a generated RODEOS semantic model instance as an asset in the
 * DLR dataspace: uploads the JSON to the connector storage and creates a
 * data offer (with policies) for it.
 */
export async function POST(request: Request) {
  const config = getDataspaceConfig()
  if (!config) {
    return Response.json(
      {
        error:
          "Dataspace access is not configured. Set DATASPACE_API_KEY and DATASPACE_CONNECTOR in the .env file.",
      },
      { status: 503 }
    )
  }

  let body: RegisterRequest
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const instance = body.instance
  if (!instance || typeof instance !== "object" || Object.keys(instance).length === 0) {
    return Response.json(
      { error: "Field 'instance' with the semantic model instance is required" },
      { status: 400 }
    )
  }

  const identifier =
    typeof instance["dcterms:identifier"] === "string"
      ? instance["dcterms:identifier"]
      : typeof instance["dcterms:title"] === "string"
        ? instance["dcterms:title"]
        : "rodeos-semantic-instance"
  const filename = `${slugify(identifier) || "rodeos-semantic-instance"}.json`

  const title =
    typeof instance["dcterms:title"] === "string"
      ? instance["dcterms:title"]
      : filename
  const description =
    typeof instance["dcterms:description"] === "string"
      ? instance["dcterms:description"].slice(0, 500)
      : "RODEOS semantic model instance"

  try {
    // The upload endpoint only works for storage-backed connectors; check
    // upfront to turn the API's bare "501 Not implemented" into guidance.
    const { connector, available } = await getConnectorInfo(config)
    if (!connector) {
      return Response.json(
        {
          error: `Connector "${config.connector}" not found. Your API key has access to: ${
            available.join(", ") || "none"
          }. Check DATASPACE_CONNECTOR in the .env file.`,
        },
        { status: 400 }
      )
    }
    if (connector.storageType === "HttpData") {
      return Response.json(
        {
          error: `Connector "${config.connector}" is an HttpData connector without file storage — the dataspace cannot store the JSON there. Create an S3-backed connector in the dataspace dashboard (Dashboard → Connectors → storage type Amazon S3) and set DATASPACE_CONNECTOR to its name.`,
        },
        { status: 400 }
      )
    }
    if (connector.status !== "RUNNING") {
      return Response.json(
        {
          error: `Connector "${config.connector}" is not running (status: ${connector.status}). Start it in the dataspace dashboard first.`,
        },
        { status: 400 }
      )
    }

    await uploadJsonFile(config, filename, JSON.stringify(instance, null, 2))
    const policies = await resolvePolicies(config)
    await createOffer(config, filename, policies, {
      name: title,
      description,
      offerType: "data",
      contenttype: "application/json",
      rodeosCoreType: instance["rodeos:coreType"] ?? "unknown",
      rodeosSemanticModel: true,
      ...(typeof instance["dcat:version"] === "string"
        ? { version: instance["dcat:version"] }
        : {}),
    })

    return Response.json({
      filename,
      connector: config.connector,
      accessPolicyId: policies.accessPolicyId,
      contractPolicyId: policies.contractPolicyId,
      policySource: policies.source,
    })
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    )
  }
}
