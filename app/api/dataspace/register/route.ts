import {
  createOffer,
  getConnectorInfo,
  resolveDataspaceConfig,
  resolvePolicies,
  uploadJsonFile,
} from "@/lib/dataspace"
import { validateInstance } from "@/lib/instance"
import {
  buildKitMetadata,
  describeKitMetadata,
  kitAssetProperties,
} from "@/lib/kit-metadata"

interface RegisterRequest {
  instance?: Record<string, unknown>
  /** Validate and report, but do not touch the dataspace. */
  dryRun?: boolean
  /** Override the policies from the environment for this one offer. */
  policies?: { accessPolicyId?: string; contractPolicyId?: string }
  /** Manual sub-type selections for hierarchy levels the instance does not determine (path key → instance key). */
  selections?: Record<string, string>
  /** Connection details for this call; each field falls back to the server environment. */
  dataspace?: { apiUrl?: string; apiKey?: string; connector?: string }
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

  // The UI disables the button until the form is complete; the API is also
  // called by scripts, so the same rule is enforced here.
  const validation = validateInstance(instance, {
    selections:
      body.selections && typeof body.selections === "object" ? body.selections : undefined,
  })
  if (!validation.ok) {
    const parts = [
      validation.missing.length ? `missing: ${validation.missing.join(", ")}` : "",
      Object.keys(validation.invalid).length
        ? `invalid: ${Object.entries(validation.invalid)
            .map(([k, v]) => `${k} (${v})`)
            .join("; ")}`
        : "",
    ].filter(Boolean)
    return Response.json(
      {
        error: `Instance is not complete — ${parts.join("; ")}`,
        missing: validation.missing,
        invalid: validation.invalid,
        unknown: validation.unknown,
      },
      { status: 422 }
    )
  }

  const identifier =
    typeof instance["dcterms:identifier"] === "string"
      ? instance["dcterms:identifier"]
      : typeof instance["dcterms:title"] === "string"
        ? instance["dcterms:title"]
        : "rodeos-semantic-instance"
  const filename = `${slugify(identifier) || "rodeos-semantic-instance"}.json`

  // Only the boolean counts: a string like "false" is truthy and would turn a
  // real registration into a silent no-op that still answers 200.
  if (body.dryRun === true) {
    return Response.json({
      dryRun: true,
      filename,
      path: validation.path,
      operationalPath: validation.operationalPath,
      unknown: validation.unknown,
      kitMetadata: describeKitMetadata(buildKitMetadata(instance)),
    })
  }

  // Half an override would silently take the other id from the environment and
  // offer the asset under a policy pair nobody asked for.
  const override = body.policies
  if (override && typeof override === "object") {
    const hasAccess = typeof override.accessPolicyId === "string" && override.accessPolicyId !== ""
    const hasContract =
      typeof override.contractPolicyId === "string" && override.contractPolicyId !== ""
    if (hasAccess !== hasContract) {
      return Response.json(
        {
          error:
            "A policy override needs both accessPolicyId and contractPolicyId — giving only one would mix it with the policy from the environment.",
        },
        { status: 400 }
      )
    }
  }

  const envConfig = resolveDataspaceConfig(
    body.dataspace && typeof body.dataspace === "object" ? body.dataspace : undefined
  )
  if (!envConfig) {
    return Response.json(
      {
        error:
          "Dataspace access is not configured. Enter API key and connector in the Data Space connection panel, or set DATASPACE_API_KEY and DATASPACE_CONNECTOR in the server environment (.env file, or the container's environment).",
      },
      { status: 503 }
    )
  }
  const config = {
    ...envConfig,
    accessPolicyId: body.policies?.accessPolicyId || envConfig.accessPolicyId,
    contractPolicyId: body.policies?.contractPolicyId || envConfig.contractPolicyId,
  }

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
          }. Check the connector name in the Data Space connection panel (or DATASPACE_CONNECTOR in the server environment).`,
        },
        { status: 400 }
      )
    }
    if (connector.storageType === "HttpData") {
      return Response.json(
        {
          error: `Connector "${config.connector}" is an HttpData connector without file storage — the dataspace cannot store the JSON there. Create an S3-backed connector in the dataspace dashboard (Dashboard → Connectors → storage type Amazon S3) and use its name as the connector.`,
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
      // Every field of the semantic model instance becomes a top-level
      // asset property (e.g. "rodeos:payload": 10.5), so assets are
      // searchable by their semantic metadata in the dataspace catalog.
      // Note: keys whose prefix is in the EDC JSON-LD context (e.g.
      // "dcat:keyword") are stored under their expanded IRI.
      ...instance,
      // Untouched nested copy for lossless retrieval of the instance.
      rodeosInstance: instance,
      // The same asset projected onto the KIT metadata specification
      // (operational_type, image_name, hardware_requirements …) so KIT
      // builders can compose the asset without knowing RODEOS CURIEs.
      ...kitAssetProperties(instance),
      // Curated display properties used by the dataspace dashboard —
      // listed last so they always win over instance keys. The dashboard
      // links the uploaded file to this asset via "filename", and its Edit
      // dialog additionally requires "name" to equal the filename (native
      // dataspace assets follow the same convention); the human-readable
      // title stays available in dcterms:title/title.
      filename,
      name: filename,
      title,
      // Shortened for the dashboard listing; kitMetadata.description keeps
      // the full text.
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
      kitMetadata: describeKitMetadata(buildKitMetadata(instance)),
      unknown: validation.unknown,
    })
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    )
  }
}
