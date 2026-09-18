import rawModel from "@/semantic_model.json"
import rawOperationalModel from "@/operational_model.json"

/**
 * The models (semantic_model.json and operational_model.json at the
 * repository root) are the single source of truth for every form the app
 * renders. Nothing about the hierarchies or the fields is hard-coded here
 * beyond the auto-selection rules the models themselves encode via enum
 * fields (rodeos:coreType, rodeos:componentType, rodeos:operationalType).
 *
 * Two orthogonal axes describe an asset:
 *
 *   semantic    — dcat:Resource → what the asset *is* (a 6-DOF robot arm)
 *   operational — rodeos:OperationalProfile → how it is *delivered and
 *                 invoked* (a container image for linux/amd64)
 *
 * They are deliberately independent: a rodeos:Dataset can be shipped as a
 * static file, a file service or a stream, so the operational type cannot be
 * derived from rodeos:coreType. Both axes feed one flat instance document.
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

export type OperationalModel = {
  "rodeos:OperationalProfile": ModelNode
} & Record<string, unknown>

export const semanticModel = rawModel as unknown as SemanticModel
export const operationalModel =
  rawOperationalModel as unknown as OperationalModel

export function getResourceNode(): ModelNode {
  return semanticModel["dcat:Resource"]
}

export function getOperationalNode(): ModelNode {
  return operationalModel["rodeos:OperationalProfile"]
}

/**
 * An axis is a root node plus the enum fields that auto-select the next
 * hierarchy level ("X" → instance key "rodeos:X").
 */
export interface Axis {
  id: "semantic" | "operational"
  root: ModelNode
  autoSelectors: string[]
}

export const SEMANTIC_AXIS: Axis = {
  id: "semantic",
  root: getResourceNode(),
  autoSelectors: [
    "rodeos:coreType",
    "rodeos:componentType",
    "rodeos:softwareAssetType",
  ],
}

export const OPERATIONAL_AXIS: Axis = {
  id: "operational",
  root: getOperationalNode(),
  autoSelectors: ["rodeos:operationalType"],
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
  | "requirement"
  | "jsonOrUri"

export interface ParsedFieldType {
  kind: FieldKind
  isList: boolean
  enumValues: string[]
  pattern: RegExp | null
  /** Original type string, e.g. "xsd:decimal" or "enum[a, b]" */
  raw: string
  placeholder: string
  /**
   * For "requirement" fields: the namespace every subject must start with
   * ("hardware", "software" or "dataspace").
   */
  namespace: string | null
}

const URI_PATTERN = /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
export const MAILTO_PATTERN = /^mailto:[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const INT_PATTERN = /^-?\d+$/
const DECIMAL_PATTERN = /^-?\d+\.?\d*$/
const HEX_PATTERN = /^[0-9A-Fa-f]+$/
const REQUIREMENT_PATTERN = /^rodeos:Requirement\[([a-z]+)\]$/

export function parseFieldType(fieldType: string): ParsedFieldType {
  const result: ParsedFieldType = {
    kind: "text",
    isList: false,
    enumValues: [],
    pattern: null,
    raw: fieldType,
    placeholder: "",
    namespace: null,
  }

  let inner = fieldType
  if (inner.startsWith("List[") && inner.endsWith("]")) {
    result.isList = true
    inner = inner.slice(5, -1)
  }

  const requirement = REQUIREMENT_PATTERN.exec(inner)
  if (requirement) {
    result.kind = "requirement"
    result.namespace = requirement[1]
    return result
  }

  if (inner === "rodeos:jsonOrUri") {
    result.kind = "jsonOrUri"
    result.placeholder = "https://… or a JSON object"
    return result
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

/* ------------------------------------------------------------------ */
/* Requirement expressions (KIT specification)                         */
/* ------------------------------------------------------------------ */

/**
 * A single requirement item of the KIT specification's small DSL, e.g.
 * "hardware.memory >= 8 GB" → { subject, operator, value }. `value` is
 * optional — operators like "required" carry no value.
 */
export interface Requirement {
  subject: string
  operator: string
  value?: string
}

export interface OperatorSpec {
  /** Operator literal as it appears between subject and value. */
  operator: string
  /** Whether the expression needs a value to be meaningful. */
  needsValue: boolean
  hint: string
}

/**
 * The operators the specification defines. Custom operators (any string)
 * remain allowed — the editor offers these as the well-known set.
 */
export const REQUIREMENT_OPERATORS: OperatorSpec[] = [
  { operator: "required", needsValue: false, hint: "x required" },
  { operator: "required for", needsValue: true, hint: "x required for y" },
  { operator: "=", needsValue: true, hint: "x = value" },
  { operator: ">=", needsValue: true, hint: "x >= value" },
  { operator: "<=", needsValue: true, hint: "x <= value" },
  { operator: "in", needsValue: true, hint: "x in {a, b, …}" },
]

/**
 * Subject suggestions per namespace, mirroring the taxonomy sketched in the
 * KIT specification. The lists are open — any subject is accepted, these
 * only drive the editor's autocomplete.
 */
export const REQUIREMENT_SUBJECTS: Record<string, string[]> = {
  hardware: [
    "hardware.compute.cpu",
    "hardware.compute.cpu.architecture",
    "hardware.compute.memory",
    "hardware.compute.gpu",
    "hardware.robot",
    "hardware.end_effector",
    "hardware.sensor.camera",
    "hardware.sensor.lidar",
    "hardware.sensor.radar",
    "hardware.sensor.imu",
    "hardware.sensor.force_torque",
    "hardware.sensor.proximity",
    "hardware.sensor.encoder",
    "hardware.interface.usb",
    "hardware.interface.ethernet",
    "hardware.interface.serial",
    "hardware.interface.i2c",
    "hardware.interface.gpio",
  ],
  software: [
    "software.os",
    "software.runtime",
    "software.runtime.python",
    "software.framework",
    "software.middleware",
    "software.api",
    "software.service",
    "software.network",
    "software.filesystem",
    "software.package",
    "software.permission",
  ],
  dataspace: [
    "dataspace.connector",
    "dataspace.connector.dlr",
    "dataspace.policy.access",
    "dataspace.negotiation",
    "dataspace.negotiation.dlr",
    "dataspace.transfer",
    "dataspace.permission",
  ],
}

/**
 * Parse the specification's textual form back into a requirement item, e.g.
 * "software.runtime.python >= 3.12". Operators are matched longest-first so
 * "required for" wins over "required" and ">=" over "=".
 *
 * A subject is a dotted namespace path and never contains a space, which is
 * what separates a known operator from a custom one: in "software.api is not
 * required" the trailing "required" is part of the operator, not the whole
 * of it. Anything that matches no known operator falls back to "first token
 * is the subject, the rest is the operator", so custom operators survive.
 */
export function parseRequirementText(text: string): Requirement | null {
  const trimmed = text.trim()
  if (!trimmed) return null

  const byLength = [...REQUIREMENT_OPERATORS].sort(
    (a, b) => b.operator.length - a.operator.length
  )
  for (const spec of byLength) {
    const infix = ` ${spec.operator} `
    const index = trimmed.indexOf(infix)
    if (index > 0) {
      const subject = trimmed.slice(0, index).trim()
      const value = trimmed.slice(index + infix.length).trim()
      if (subject && !subject.includes(" ")) {
        return value
          ? { subject, operator: spec.operator, value }
          : { subject, operator: spec.operator }
      }
    }
    const suffix = ` ${spec.operator}`
    if (!spec.needsValue && trimmed.endsWith(suffix)) {
      const subject = trimmed.slice(0, -suffix.length).trim()
      if (subject && !subject.includes(" ")) {
        return { subject, operator: spec.operator }
      }
    }
  }

  // Custom operator: everything after the subject.
  const firstSpace = trimmed.indexOf(" ")
  if (firstSpace > 0) {
    const subject = trimmed.slice(0, firstSpace)
    const operator = trimmed.slice(firstSpace + 1).trim()
    if (operator) return { subject, operator }
  }
  return null
}

/**
 * Coerce whatever an LLM returned for a requirement field into requirement
 * items: an array of objects, an array of DSL strings, or a single string.
 */
export function coerceRequirements(raw: unknown): Requirement[] {
  const items = Array.isArray(raw) ? raw : [raw]
  const out: Requirement[] = []
  for (const item of items) {
    if (typeof item === "string") {
      const parsed = parseRequirementText(item)
      if (parsed) out.push(parsed)
      continue
    }
    if (item && typeof item === "object") {
      const row = item as Partial<Requirement>
      const subject = String(row.subject ?? "").trim()
      const operator = String(row.operator ?? "").trim()
      if (!subject || !operator) continue
      const value = String(row.value ?? "").trim()
      out.push(value ? { subject, operator, value } : { subject, operator })
    }
  }
  return out
}

/** Render a requirement in the specification's textual DSL form. */
export function requirementToText(req: Requirement): string {
  const value = req.value?.trim()
  return [req.subject.trim(), req.operator.trim(), value]
    .filter((part) => part)
    .join(" ")
}

/** True for a row the user has not filled in at all — dropped on output. */
export function isEmptyRequirement(req: Requirement): boolean {
  return !req.subject.trim() && !req.operator.trim() && !req.value?.trim()
}

export interface ValidationResult {
  ok: boolean
  /** Coerced value ready for the output JSON (number, boolean, string, array). */
  value?: unknown
  error?: string
}

function validateRequirements(
  namespace: string | null,
  raw: unknown
): ValidationResult {
  if (!Array.isArray(raw)) return { ok: true, value: undefined }

  const rows = raw as Requirement[]
  const out: Requirement[] = []
  for (const row of rows) {
    if (!row || typeof row !== "object" || isEmptyRequirement(row)) continue
    const subject = String(row.subject ?? "").trim()
    const operator = String(row.operator ?? "").trim()
    const value = String(row.value ?? "").trim()

    if (!subject) return { ok: false, error: "Every requirement needs a subject" }
    if (!operator)
      return { ok: false, error: `"${subject}" is missing an operator` }
    if (namespace && subject !== namespace && !subject.startsWith(`${namespace}.`))
      return {
        ok: false,
        error: `Subject must start with "${namespace}." — got "${subject}"`,
      }

    out.push(value ? { subject, operator, value } : { subject, operator })
  }

  return { ok: true, value: out.length ? out : undefined }
}

/**
 * request_schema / response_schema of the KIT specification: either a URI
 * pointing at the schema or the schema document itself.
 */
function validateJsonOrUri(raw: unknown): ValidationResult {
  if (raw && typeof raw === "object") return { ok: true, value: raw }
  const trimmed = String(raw ?? "").trim()
  if (!trimmed) return { ok: true, value: undefined }
  if (URI_PATTERN.test(trimmed)) return { ok: true, value: trimmed }
  try {
    return { ok: true, value: JSON.parse(trimmed) }
  } catch {
    return {
      ok: false,
      error: "Enter a schema URL (http://, https://) or a valid JSON object",
    }
  }
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

  // Object-valued fields carry their own shape — they must be handled
  // before the generic list path, which splits strings on commas.
  if (parsed.kind === "requirement") {
    return validateRequirements(parsed.namespace, raw)
  }
  if (parsed.kind === "jsonOrUri") {
    return validateJsonOrUri(raw)
  }

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

/**
 * Keys the UI stores manual sub-type selections under: path joined by "/".
 * Non-semantic axes are namespaced so their root level ("") cannot collide.
 */
export function pathKey(path: string[], axis: Axis["id"] = "semantic"): string {
  const joined = path.join("/")
  return axis === "semantic" ? joined : `${axis}:${joined}`
}

export interface Level {
  /** Instance keys from the axis root down to this node (root = []). */
  path: string[]
  node: ModelNode
  /** Which axis this level belongs to. */
  axis: Axis["id"]
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
 * "X" to the instance key "rodeos:X". The operational axis uses the same
 * rule via `rodeos:operationalType`.
 */
export function autoSelectorField(node: ModelNode, autoSelectors: string[]): string | null {
  const fields = { ...node.mandatory, ...node.optional }
  for (const name of autoSelectors) {
    if (name in fields) return name
  }
  return null
}

/**
 * Compute the chain of active hierarchy levels of one axis given the current
 * field values and manual sub-type selections.
 */
export function computeLevels(
  values: Record<string, unknown>,
  selections: Record<string, string>,
  axis: Axis = SEMANTIC_AXIS
): Level[] {
  const levels: Level[] = []
  let node: ModelNode | undefined = axis.root
  const path: string[] = []

  while (node) {
    const level: Level = {
      path: [...path],
      node,
      axis: axis.id,
      selectionOptions: null,
      selectedChild: null,
    }
    levels.push(level)

    if (!node.instances || Object.keys(node.instances).length === 0) break

    const auto = autoSelectorField(node, axis.autoSelectors)
    let childKey: string | null = null
    if (auto) {
      const v = values[auto]
      if (typeof v === "string" && v) childKey = `rodeos:${v}`
    } else {
      level.selectionOptions = Object.keys(node.instances)
      const sel = selections[pathKey(path, axis.id)]
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
export function collectFieldsForPath(
  path: string[],
  axis: Axis = SEMANTIC_AXIS
): {
  mandatory: FieldMap
  optional: FieldMap
  defaults: Record<string, string>
} {
  const mandatory: FieldMap = {}
  const optional: FieldMap = {}
  const defaults: Record<string, string> = {}
  let node: ModelNode | undefined = axis.root
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
export function sanitizePath(
  path: string[],
  axis: Axis = SEMANTIC_AXIS
): string[] {
  let node: ModelNode | undefined = axis.root
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

/**
 * Translate a hierarchy path into the form state that produces it: values
 * for the auto-selector enums (coreType, componentType, softwareAssetType,
 * operationalType) and manual selections for levels without one. Inverse of
 * computeLevels, used when an LLM result or an imported instance names a path.
 */
export function autoSelectorValuesForPath(
  path: string[],
  axis: Axis = SEMANTIC_AXIS
): { values: Record<string, string>; selections: Record<string, string> } {
  const values: Record<string, string> = {}
  const selections: Record<string, string> = {}
  let node: ModelNode | undefined = axis.root
  const walked: string[] = []
  for (const key of path) {
    if (!node?.instances || !(key in node.instances)) break
    const auto = autoSelectorField(node, axis.autoSelectors)
    if (auto) values[auto] = key.replace(/^rodeos:/, "")
    else selections[pathKey(walked, axis.id)] = key
    walked.push(key)
    node = node.instances[key]
  }
  return { values, selections }
}
