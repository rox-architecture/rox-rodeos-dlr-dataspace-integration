import rawModel from "@/semantic_model.json"

/**
 * The semantic model (semantic_model.json at the repository root) is the
 * single source of truth for every form the app renders. Nothing about the
 * hierarchy or the fields is hard-coded here beyond the two auto-selection
 * rules the model itself encodes via enum fields (rodeos:coreType and
 * rodeos:componentType).
 */

export type FieldMap = Record<string, string>

export interface ModelNode {
  mandatory?: FieldMap
  optional?: FieldMap
  instances?: Record<string, ModelNode>
  defaultValues?: Record<string, string>
}

export type SemanticModel = {
  "dcat:Resource": ModelNode
} & Record<string, unknown>

export const semanticModel = rawModel as unknown as SemanticModel

export function getResourceNode(): ModelNode {
  return semanticModel["dcat:Resource"]
}

/* ------------------------------------------------------------------ */
/* Field type parsing                                                  */
/* ------------------------------------------------------------------ */

export type FieldKind =
  | "text"
  | "integer"
  | "decimal"
  | "boolean"
  | "uri"
  | "hex"
  | "duration"
  | "enum"

export interface ParsedFieldType {
  kind: FieldKind
  isList: boolean
  enumValues: string[]
  pattern: RegExp | null
  /** Original type string, e.g. "xsd:decimal" or "enum[a, b]" */
  raw: string
  placeholder: string
}

const URI_PATTERN = /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const MAILTO_PATTERN = /^mailto:[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const INT_PATTERN = /^-?\d+$/
const DECIMAL_PATTERN = /^-?\d+\.?\d*$/
const HEX_PATTERN = /^[0-9A-Fa-f]+$/

export function parseFieldType(fieldType: string): ParsedFieldType {
  const result: ParsedFieldType = {
    kind: "text",
    isList: false,
    enumValues: [],
    pattern: null,
    raw: fieldType,
    placeholder: "",
  }

  let inner = fieldType
  if (inner.startsWith("List[") && inner.endsWith("]")) {
    result.isList = true
    inner = inner.slice(5, -1)
  }

  if (inner.startsWith("enum[") && inner.endsWith("]")) {
    result.kind = "enum"
    result.enumValues = inner
      .slice(5, -1)
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean)
  } else if (inner === "xsd:integer") {
    result.kind = "integer"
    result.pattern = INT_PATTERN
    result.placeholder = "e.g. 6"
  } else if (inner === "xsd:decimal") {
    result.kind = "decimal"
    result.pattern = DECIMAL_PATTERN
    result.placeholder = "e.g. 12.5"
  } else if (inner === "xsd:boolean") {
    result.kind = "boolean"
  } else if (inner === "xsd:anyUri") {
    result.kind = "uri"
    result.pattern = URI_PATTERN
    result.placeholder = "https://example.com or name@example.com"
  } else if (inner === "xsd:hexBinary") {
    result.kind = "hex"
    result.pattern = HEX_PATTERN
    result.placeholder = "e.g. A3F0"
  } else if (inner === "xsd:duration") {
    result.kind = "duration"
    result.placeholder = "e.g. PT8H (ISO 8601)"
  } else {
    // xsd:text, skos:concept, schema:quantitativeValue …
    result.kind = "text"
  }

  return result
}

export interface ValidationResult {
  ok: boolean
  /** Coerced value ready for the output JSON (number, boolean, string, array). */
  value?: unknown
  error?: string
}

function validateScalar(parsed: ParsedFieldType, raw: string): ValidationResult {
  const trimmed = raw.trim()
  if (trimmed === "") return { ok: true, value: undefined }

  switch (parsed.kind) {
    case "integer":
      if (!INT_PATTERN.test(trimmed))
        return { ok: false, error: `Not a valid integer: "${trimmed}"` }
      return { ok: true, value: parseInt(trimmed, 10) }
    case "decimal":
      if (!DECIMAL_PATTERN.test(trimmed))
        return { ok: false, error: `Not a valid decimal: "${trimmed}"` }
      return { ok: true, value: parseFloat(trimmed) }
    case "uri":
      // xsd:anyUri: URLs, mailto: URIs and plain email addresses
      // (common for dcat:contactPoint) are all accepted.
      if (
        !URI_PATTERN.test(trimmed) &&
        !EMAIL_PATTERN.test(trimmed) &&
        !MAILTO_PATTERN.test(trimmed)
      )
        return {
          ok: false,
          error:
            "Invalid — enter a URL (http://, https://, ftp://) or an email address",
        }
      return { ok: true, value: trimmed }
    case "hex":
      if (!HEX_PATTERN.test(trimmed))
        return { ok: false, error: "Invalid hex value — use 0-9 and A-F only" }
      return { ok: true, value: trimmed }
    case "enum":
      if (!parsed.enumValues.includes(trimmed))
        return {
          ok: false,
          error: `Must be one of: ${parsed.enumValues.join(", ")}`,
        }
      return { ok: true, value: trimmed }
    default:
      return { ok: true, value: trimmed }
  }
}

/**
 * Validate the raw UI state of a field (string for scalars, string[] for
 * lists, boolean for booleans) against its declared type.
 */
export function validateField(fieldType: string, raw: unknown): ValidationResult {
  const parsed = parseFieldType(fieldType)

  if (parsed.kind === "boolean" && !parsed.isList) {
    if (typeof raw === "boolean") return { ok: true, value: raw }
    return { ok: true, value: undefined }
  }

  if (parsed.isList) {
    const items = Array.isArray(raw)
      ? raw.map(String)
      : String(raw ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
    if (items.length === 0) return { ok: true, value: undefined }
    const out: unknown[] = []
    for (const item of items) {
      const res = validateScalar(parsed, item)
      if (!res.ok) return res
      if (res.value !== undefined) out.push(res.value)
    }
    return { ok: true, value: out.length ? out : undefined }
  }

  return validateScalar(parsed, String(raw ?? ""))
}

/* ------------------------------------------------------------------ */
/* Hierarchy navigation                                                */
/* ------------------------------------------------------------------ */

/** Keys the UI stores manual sub-type selections under: path joined by "/". */
export function pathKey(path: string[]): string {
  return path.join("/")
}

export interface Level {
  /** Instance keys from dcat:Resource down to this node (root = []). */
  path: string[]
  node: ModelNode
  /**
   * Set when this node has instances but no auto-selection rule — the UI
   * must render a sub-type selector with these options.
   */
  selectionOptions: string[] | null
  /** The instance key chosen for the next level (auto or manual), if any. */
  selectedChild: string | null
}

/**
 * A field enum whose value determines the child instance automatically,
 * mirroring the reference implementation: `rodeos:coreType` on the root
 * resource and `rodeos:componentType` on rodeos:Component map their value
 * "X" to the instance key "rodeos:X".
 */
function autoSelectorField(node: ModelNode): string | null {
  const fields = { ...node.mandatory, ...node.optional }
  for (const name of ["rodeos:coreType", "rodeos:componentType"]) {
    if (name in fields) return name
  }
  return null
}

/**
 * Compute the chain of active hierarchy levels given the current field
 * values and manual sub-type selections.
 */
export function computeLevels(
  values: Record<string, unknown>,
  selections: Record<string, string>
): Level[] {
  const levels: Level[] = []
  let node: ModelNode | undefined = getResourceNode()
  const path: string[] = []

  while (node) {
    const level: Level = {
      path: [...path],
      node,
      selectionOptions: null,
      selectedChild: null,
    }
    levels.push(level)

    if (!node.instances || Object.keys(node.instances).length === 0) break

    const auto = autoSelectorField(node)
    let childKey: string | null = null
    if (auto) {
      const v = values[auto]
      if (typeof v === "string" && v) childKey = `rodeos:${v}`
    } else {
      level.selectionOptions = Object.keys(node.instances)
      const sel = selections[pathKey(path)]
      if (sel) childKey = sel
    }

    if (!childKey || !(childKey in node.instances)) break
    level.selectedChild = childKey
    path.push(childKey)
    node = node.instances[childKey]
  }

  return levels
}

/** All fields (name → type) visible on the active path. */
export function collectActiveFields(levels: Level[]): {
  mandatory: FieldMap
  optional: FieldMap
  defaults: Record<string, string>
} {
  const mandatory: FieldMap = {}
  const optional: FieldMap = {}
  const defaults: Record<string, string> = {}
  for (const level of levels) {
    Object.assign(mandatory, level.node.mandatory ?? {})
    Object.assign(optional, level.node.optional ?? {})
    Object.assign(defaults, level.node.defaultValues ?? {})
  }
  return { mandatory, optional, defaults }
}

/** Human-readable label for an instance key: "rodeos:mobileRobot" → "Mobile Robot". */
export function instanceLabel(key: string): string {
  return key
    .replace(/^rodeos:/, "")
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase())
}

/** Merged mandatory/optional fields for an explicit hierarchy path. */
export function collectFieldsForPath(path: string[]): {
  mandatory: FieldMap
  optional: FieldMap
  defaults: Record<string, string>
} {
  const mandatory: FieldMap = {}
  const optional: FieldMap = {}
  const defaults: Record<string, string> = {}
  let node: ModelNode | undefined = getResourceNode()
  const visit = (n: ModelNode) => {
    Object.assign(mandatory, n.mandatory ?? {})
    Object.assign(optional, n.optional ?? {})
    Object.assign(defaults, n.defaultValues ?? {})
  }
  visit(node)
  for (const key of path) {
    if (!node?.instances || !(key in node.instances)) break
    node = node.instances[key]
    visit(node)
  }
  return { mandatory, optional, defaults }
}

/** All instance-key chains from `node` down to a descendant named `key`. */
function findChainsToKey(node: ModelNode, key: string): string[][] {
  const chains: string[][] = []
  const walk = (n: ModelNode, prefix: string[]) => {
    for (const [childKey, child] of Object.entries(n.instances ?? {})) {
      const chain = [...prefix, childKey]
      if (childKey === key) chains.push(chain)
      walk(child, chain)
    }
  }
  walk(node, [])
  return chains
}

/**
 * Verify a hierarchy path proposed by the LLM against the model and repair
 * it where possible: skipped intermediate levels (e.g. "roboter" →
 * "serielRobot" without "stationaryRobot") are filled in when the target key
 * exists at a unique deeper position. Returns the longest valid path.
 */
export function sanitizePath(path: string[]): string[] {
  let node: ModelNode | undefined = getResourceNode()
  const valid: string[] = []
  for (const key of path) {
    if (!node?.instances) break
    if (key in node.instances) {
      valid.push(key)
      node = node.instances[key]
      continue
    }
    const chains = findChainsToKey(node, key)
    if (chains.length !== 1) break
    for (const step of chains[0]) {
      valid.push(step)
      node = node!.instances![step]
    }
  }
  return valid
}
