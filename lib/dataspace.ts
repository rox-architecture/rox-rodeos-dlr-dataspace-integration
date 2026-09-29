/**
 * Client for the DLR / Vision-X dataspace API (base-x-ecosystem, provided by
 * the DLR Institute for AI Safety and Security).
 *
 * Registering a semantic model instance follows the same flow the dataspace
 * dashboard uses ("Your Assets" → upload file → create offer):
 *
 *   1. GET  /ui/{connector}/files/upload/{filename} → presigned upload URL
 *   2. PUT  the JSON document to that URL (connector S3 storage)
 *   3. Resolve access/contract policies (env override → existing → create)
 *   4. POST /ui/{connector}/assets → create the offer with metadata
 *
 * API reference: https://vision-x-api.base-x-ecosystem.org/docs
 */

export interface DataspaceConfig {
  apiUrl: string
  apiKey: string
  connector: string
  accessPolicyId?: string
  contractPolicyId?: string
}

export const DEFAULT_DATASPACE_API_URL = "https://vision-x-api.base-x-ecosystem.org"

/** Connection details a single caller brings along instead of using the server's. */
export interface DataspaceOverrides {
  apiUrl?: string
  apiKey?: string
  connector?: string
}

const trimmed = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined
  const clean = value.trim()
  return clean === "" ? undefined : clean
}

/**
 * Build the connection to use for one call. Per-request details win over the
 * server environment field by field, so a deployment can serve users who each
 * bring their own connector while a local run with a filled .env needs no
 * input at all.
 */
export function resolveDataspaceConfig(
  overrides?: DataspaceOverrides
): DataspaceConfig | null {
  const apiKey = trimmed(overrides?.apiKey) ?? trimmed(process.env.DATASPACE_API_KEY)
  const connector =
    trimmed(overrides?.connector) ?? trimmed(process.env.DATASPACE_CONNECTOR)
  if (!apiKey || !connector) return null
  return {
    apiUrl: (
      trimmed(overrides?.apiUrl) ??
      trimmed(process.env.DATASPACE_API_URL) ??
      DEFAULT_DATASPACE_API_URL
    ).replace(/\/$/, ""),
    apiKey,
    connector,
    accessPolicyId: process.env.DATASPACE_ACCESS_POLICY_ID || undefined,
    contractPolicyId: process.env.DATASPACE_CONTRACT_POLICY_ID || undefined,
  }
}

/** The connection the server environment alone provides, if it is complete. */
export function getDataspaceConfig(): DataspaceConfig | null {
  return resolveDataspaceConfig()
}

async function api(
  config: DataspaceConfig,
  method: string,
  path: string,
  body?: unknown
): Promise<Response> {
  const res = await fetch(`${config.apiUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(
      `Dataspace API ${method} ${path} failed (${res.status}): ${text.slice(0, 400)}`
    )
  }
  return res
}

export interface ConnectorInfo {
  connectorName: string
  bpn: string
  status: string
  storageType: "AmazonS3" | "AzureStorage" | "HttpData"
}

/**
 * Look up the configured connector among the user's connectors. File upload
 * (and thus asset registration from this app) requires a storage-backed
 * connector (AmazonS3 / AzureStorage) — HttpData connectors have no file
 * storage and the upload endpoint answers 501 for them.
 */
export async function getConnectorInfo(
  config: DataspaceConfig
): Promise<{ connector: ConnectorInfo | null; available: string[] }> {
  const res = await api(config, "GET", "/connectors")
  const connectors = (await res.json()) as Record<string, ConnectorInfo>
  return {
    connector: connectors[config.connector] ?? null,
    available: Object.keys(connectors),
  }
}

/** Default ODRL access policy, mirroring the API's documented example. */
const DEFAULT_POLICY = {
  "@type": "odrl:Set",
  "odrl:permission": [{ "odrl:action": { "@id": "cx-policy:access" } }],
}

export interface PolicyResolution {
  accessPolicyId: string
  contractPolicyId: string
  source: "env" | "existing" | "created"
}

/**
 * Determine the policies for the new offer: explicit env configuration wins;
 * otherwise reuse the connector's first existing policy (the dashboard's
 * default template); as a last resort create a permissive default policy.
 */
export async function resolvePolicies(
  config: DataspaceConfig
): Promise<PolicyResolution> {
  if (config.accessPolicyId && config.contractPolicyId) {
    return {
      accessPolicyId: config.accessPolicyId,
      contractPolicyId: config.contractPolicyId,
      source: "env",
    }
  }

  const res = await api(config, "GET", `/ui/${config.connector}/policies`)
  const policies = (await res.json()) as Array<{ id: string }>
  if (Array.isArray(policies) && policies.length > 0) {
    const fallback = policies[0].id
    return {
      accessPolicyId: config.accessPolicyId ?? fallback,
      contractPolicyId: config.contractPolicyId ?? fallback,
      source: "existing",
    }
  }

  const id = crypto.randomUUID()
  await api(config, "POST", `/ui/${config.connector}/policies`, {
    id,
    policy: DEFAULT_POLICY,
  })
  return { accessPolicyId: id, contractPolicyId: id, source: "created" }
}

export async function uploadJsonFile(
  config: DataspaceConfig,
  filename: string,
  content: string
): Promise<void> {
  const res = await api(
    config,
    "GET",
    `/ui/${config.connector}/files/upload/${encodeURIComponent(filename)}`
  )
  const { url } = (await res.json()) as { url: string }

  const upload = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: content,
  })
  if (!upload.ok) {
    const text = await upload.text()
    throw new Error(
      `File upload to connector storage failed (${upload.status}): ${text.slice(0, 300)}`
    )
  }
}

export async function createOffer(
  config: DataspaceConfig,
  filename: string,
  policies: PolicyResolution,
  properties: Record<string, unknown>
): Promise<void> {
  await api(config, "POST", `/ui/${config.connector}/assets`, {
    key: filename,
    accessPolicyId: policies.accessPolicyId,
    contractPolicyId: policies.contractPolicyId,
    properties,
  })
}
