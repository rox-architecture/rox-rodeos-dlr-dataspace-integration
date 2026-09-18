/**
 * Working with finished instance documents (as opposed to live form state):
 *
 *   validateInstance     — check a JSON instance against both model axes
 *   inferSelections      — recover manual sub-type selections from field names
 *   instanceToFormState  — load an instance into the form (JSON import)
 *   toRawValue           — final JSON value → what the inputs edit
 *
 * The register API uses validateInstance so that incomplete instances are
 * refused server-side, not only by the disabled button in the UI.
 */

import {
  autoSelectorField,
  collectActiveFields,
  computeLevels,
  OPERATIONAL_AXIS,
  parseFieldType,
  pathKey,
  SEMANTIC_AXIS,
  validateField,
  type Axis,
  type FieldMap,
  type Level,
  type ModelNode,
} from "@/lib/semantic-model"

export type Instance = Record<string, unknown>

/** Final JSON value → the raw shape the form inputs work with. */
export function toRawValue(fieldType: string, value: unknown): unknown {
  const parsed = parseFieldType(fieldType)
  if (parsed.kind === "requirement") {
    return Array.isArray(value) ? value : []
  }
  if (parsed.kind === "jsonOrUri") {
    return typeof value === "string" ? value : JSON.stringify(value, null, 2)
  }
  if (parsed.kind === "boolean" && !parsed.isList) {
    if (typeof value === "boolean") return value
    return String(value).toLowerCase() === "true"
  }
  if (parsed.kind === "enum" && parsed.isList) {
    return Array.isArray(value) ? value.map(String) : [String(value)]
  }
  if (parsed.isList && Array.isArray(value)) return value.join(", ")
  return String(value)
}

/** Every field name declared on a node or any of its descendants. */
function subtreeFieldNames(node: ModelNode): Set<string> {
  const names = new Set<string>()
  const walk = (n: ModelNode) => {
    for (const name of Object.keys({ ...n.mandatory, ...n.optional })) names.add(name)
    for (const child of Object.values(n.instances ?? {})) walk(child)
  }
  walk(node)
  return names
}

/**
 * Recover the manual sub-type selections an instance implies. Levels with an
 * auto-selector follow the field value; on the others the child whose
 * subtree declares the most discriminating fields present in the instance
 * wins — fields the walked path already declares do not count. A tie means
 * the instance does not say enough — the walk stops and the user picks.
 */
export function inferSelections(
  instance: Instance,
  axis: Axis = SEMANTIC_AXIS
): Record<string, string> {
  const selections: Record<string, string> = {}
  // Every key counts, null-valued ones included: the consumers skip those
  // values later, but their presence still says which branch was meant.
  const keys = Object.keys(instance)
  // Fields declared on the levels walked so far (rodeos:manufacturer is
  // optional on hardwareComponent and mandatory on tooling) tell nothing
  // about the branch below and are excluded from the scoring.
  const inherited = new Set<string>()
  let node: ModelNode | undefined = axis.root
  const walked: string[] = []

  while (node?.instances && Object.keys(node.instances).length > 0) {
    for (const name of Object.keys({ ...node.mandatory, ...node.optional })) {
      inherited.add(name)
    }
    let child: string | null = null
    const auto = autoSelectorField(node, axis.autoSelectors)
    if (auto) {
      const v = instance[auto]
      if (typeof v === "string" && v) child = `rodeos:${v}`
    } else {
      const discriminating = keys.filter((k) => !inherited.has(k))
      const ranked = Object.entries(node.instances)
        .map(([key, sub]) => {
          const names = subtreeFieldNames(sub)
          return { key, score: discriminating.filter((k) => names.has(k)).length }
        })
        .filter((c) => c.score > 0)
        .sort((a, b) => b.score - a.score)
      if (ranked.length > 0 && (ranked.length === 1 || ranked[0].score > ranked[1].score)) {
        child = ranked[0].key
        selections[pathKey(walked, axis.id)] = child
      }
    }
    if (!child || !(child in node.instances)) break
    walked.push(child)
    node = node.instances[child]
  }
  return selections
}

/** Caller-supplied state that complements what the instance itself says. */
export interface InstanceOptions {
  /**
   * Manual sub-type selections (pathKey → instance key) for levels a flat
   * document carries no discriminator for. They win over inferred ones.
   */
  selections?: Record<string, string>
}

/** Both axes resolved for one instance: the shared first step of the exports below. */
interface ResolvedInstance {
  selections: Record<string, string>
  semantic: Level[]
  operational: Level[]
  fields: {
    mandatory: FieldMap
    optional: FieldMap
    defaults: Record<string, string>
  }
}

function resolveInstance(
  instance: Instance,
  options: InstanceOptions = {}
): ResolvedInstance {
  const selections = {
    ...inferSelections(instance, SEMANTIC_AXIS),
    ...inferSelections(instance, OPERATIONAL_AXIS),
    ...options.selections,
  }
  const semantic = computeLevels(instance, selections, SEMANTIC_AXIS)
  const operational = computeLevels(instance, selections, OPERATIONAL_AXIS)
  const s = collectActiveFields(semantic)
  const o = collectActiveFields(operational)
  return {
    selections,
    semantic,
    operational,
    fields: {
      mandatory: { ...s.mandatory, ...o.mandatory },
      optional: { ...s.optional, ...o.optional },
      defaults: { ...s.defaults, ...o.defaults },
    },
  }
}

export interface InstanceValidation {
  ok: boolean
  path: string[]
  operationalPath: string[]
  /** Mandatory fields without a value, plus unfinished hierarchy levels. */
  missing: string[]
  /** Field → error message for values that do not match their type. */
  invalid: Record<string, string>
  /** Keys neither axis declares on the active paths (kept, but reported). */
  unknown: string[]
  /** Validated and coerced copy of the known fields. */
  normalized: Instance
}

/**
 * Check a finished instance document against both model axes: every
 * mandatory field on the active paths must carry a valid value, optional
 * values must match their type, and both hierarchies must be walked down to
 * a leaf. Keys the model does not declare are reported, not refused.
 *
 * An absent mandatory non-list xsd:boolean is not missing: it is normalized
 * to `false` and accepted, mirroring the form's checkbox semantics (an
 * unticked box is a value, not a gap).
 */
export function validateInstance(
  instance: Instance,
  options: InstanceOptions = {}
): InstanceValidation {
  const { semantic, operational, fields } = resolveInstance(instance, options)
  const { mandatory, optional } = fields

  const missing: string[] = []
  const invalid: Record<string, string> = {}
  const normalized: Instance = {}

  for (const [name, type] of Object.entries(mandatory)) {
    const res = validateField(type, instance[name])
    if (!res.ok) {
      invalid[name] = res.error ?? "Invalid value"
      continue
    }
    if (res.value === undefined) {
      const parsed = parseFieldType(type)
      if (parsed.kind === "boolean" && !parsed.isList) {
        normalized[name] = false
      } else {
        missing.push(name)
      }
      continue
    }
    normalized[name] = res.value
  }

  for (const [name, type] of Object.entries(optional)) {
    if (instance[name] === undefined || instance[name] === null) continue
    const res = validateField(type, instance[name])
    if (!res.ok) invalid[name] = res.error ?? "Invalid value"
    else if (res.value !== undefined) normalized[name] = res.value
  }

  // A level that still has children but none selected is not finished —
  // whether the choice is manual or an auto-selector whose value is absent
  // or unusable. The auto-selector case is reported here only when the field
  // itself is not already listed as missing or invalid.
  const axes = [
    { levels: semantic, axis: SEMANTIC_AXIS, rootLabel: "dcat:Resource" },
    {
      levels: operational,
      axis: OPERATIONAL_AXIS,
      rootLabel: "rodeos:OperationalProfile",
    },
  ]
  for (const { levels, axis, rootLabel } of axes) {
    const last = levels[levels.length - 1]
    const children = Object.keys(last.node.instances ?? {})
    if (children.length === 0 || last.selectedChild) continue
    const auto = autoSelectorField(last.node, axis.autoSelectors)
    if (auto && (missing.includes(auto) || auto in invalid)) continue
    missing.push(`sub-type below ${last.path.at(-1) ?? rootLabel}`)
  }

  const known = new Set([...Object.keys(mandatory), ...Object.keys(optional)])
  const unknown = Object.keys(instance).filter((k) => !known.has(k))

  return {
    ok: missing.length === 0 && Object.keys(invalid).length === 0,
    path: semantic[semantic.length - 1].path,
    operationalPath: operational[operational.length - 1].path,
    missing,
    invalid,
    unknown,
    normalized,
  }
}

export interface FormState {
  values: Record<string, unknown>
  selections: Record<string, string>
  applied: string[]
  skipped: string[]
  path: string[]
  operationalPath: string[]
}

/** Translate an instance document into the state the form edits. */
export function instanceToFormState(
  instance: Instance,
  options: InstanceOptions = {}
): FormState {
  const { selections, semantic, operational, fields } = resolveInstance(
    instance,
    options
  )
  const known = { ...fields.mandatory, ...fields.optional }

  const values: Record<string, unknown> = {}
  const applied: string[] = []
  const skipped: string[] = []
  for (const [name, value] of Object.entries(instance)) {
    if (value === undefined || value === null) continue
    if (!(name in known)) {
      skipped.push(name)
      continue
    }
    values[name] = toRawValue(known[name], value)
    applied.push(name)
  }
  for (const [name, def] of Object.entries(fields.defaults)) {
    if (values[name] === undefined) values[name] = def
  }

  return {
    values,
    selections,
    applied,
    skipped,
    path: semantic[semantic.length - 1].path,
    operationalPath: operational[operational.length - 1].path,
  }
}
