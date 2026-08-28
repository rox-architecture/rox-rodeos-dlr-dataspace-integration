/**
 * Bridge between the RODEOS semantic model and the KIT asset metadata
 * specification (asset_metadata_specification.md).
 *
 * The models use RODEOS CURIEs ("rodeos:imageName"); KIT builders consume
 * the specification's snake_case names ("image_name"). Rather than bending
 * one convention to the other, the instance keeps CURIEs and this module
 * projects them onto the specification when an asset is registered.
 *
 * It also encodes which operational fields are already covered by the
 * semantic axis, so the user never types the same fact twice.
 */

import {
  EMAIL_PATTERN,
  MAILTO_PATTERN,
  type Requirement,
} from "@/lib/semantic-model"

/* ------------------------------------------------------------------ */
/* Derivations: operational field ← semantic field                     */
/* ------------------------------------------------------------------ */

export interface Derivation {
  /** Operational field that can be filled from the semantic axis. */
  target: string
  /** Semantic field it is taken from. */
  source: string
  /** Only derive when the source value qualifies. */
  accept?: (value: unknown) => boolean
  /** Adapt the source value to the target field's shape. */
  transform?: (value: unknown) => unknown
}

/**
 * The specification explicitly allows omitting `description` when the
 * semantic model already carries it; the same reasoning applies to the file
 * and contact fields, which DCAT already describes.
 */
export const DERIVATIONS: Derivation[] = [
  { target: "rodeos:fileFormat", source: "rodeos:dataFormat" },
  { target: "rodeos:fileSize", source: "dcat:byteSize" },
  { target: "rodeos:checksum", source: "dcat:checksum" },
  {
    target: "rodeos:contactEmail",
    source: "dcat:contactPoint",
    // dcat:contactPoint accepts any URI — only mail addresses qualify.
    accept: (v) =>
      typeof v === "string" &&
      (EMAIL_PATTERN.test(v.trim()) || MAILTO_PATTERN.test(v.trim())),
    transform: (v) => String(v).trim().replace(/^mailto:/, ""),
  },
  { target: "rodeos:responseDataFormat", source: "rodeos:dataFormat" },
]

export interface DerivedValue {
  value: unknown
  /** Semantic field the value came from — shown as a hint in the form. */
  source: string
}

/**
 * Values the operational axis can take over from the semantic axis. They
 * behave like the model's own defaultValues: a fallback for untouched
 * fields that any user input overrides.
 */
export function deriveOperationalValues(
  values: Record<string, unknown>
): Record<string, DerivedValue> {
  const derived: Record<string, DerivedValue> = {}
  for (const rule of DERIVATIONS) {
    if (rule.target in derived) continue
    const raw = values[rule.source]
    if (raw === undefined || raw === null || String(raw).trim() === "") continue
    if (rule.accept && !rule.accept(raw)) continue
    derived[rule.target] = {
      value: rule.transform ? rule.transform(raw) : raw,
      source: rule.source,
    }
  }
  return derived
}

/* ------------------------------------------------------------------ */
/* Projection onto the KIT specification                               */
/* ------------------------------------------------------------------ */

/** CURIE in the instance → field name in the KIT specification. */
export const SPEC_FIELD_NAMES: Record<string, string> = {
  // common
  "rodeos:operationalType": "operational_type",
  "rodeos:contactEmail": "contact_email",
  "rodeos:hardwareRequirements": "hardware_requirements",
  "rodeos:softwareRequirements": "software_requirements",
  "rodeos:dataspaceRequirements": "dataspace_requirements",
  // static file
  "rodeos:fileFormat": "file_format",
  "rodeos:fileSize": "file_size",
  "rodeos:checksum": "checksum",
  "rodeos:encoding": "encoding",
  // container
  "rodeos:distributionType": "distribution_type",
  "rodeos:imageName": "image_name",
  "rodeos:imageTag": "image_tag",
  "rodeos:platforms": "platforms",
  // data / streaming service
  "rodeos:responseDataFormat": "data_format",
  "rodeos:requestMethod": "request_method",
  "rodeos:subpath": "subpath",
  "rodeos:requestSchema": "request_schema",
  "rodeos:responseSchema": "response_schema",
  "rodeos:apiUrl": "api_url",
}

/** Fields of the operational axis, in specification order. */
export const OPERATIONAL_FIELDS = Object.keys(SPEC_FIELD_NAMES)

export type KitMetadata = Record<string, unknown>

/**
 * Project a semantic model instance onto the KIT specification. Returns
 * null when the instance carries no operational type — without it there is
 * nothing a KIT builder could compose.
 */
export function buildKitMetadata(
  instance: Record<string, unknown>
): KitMetadata | null {
  if (!instance["rodeos:operationalType"]) return null

  const kit: KitMetadata = {}
  for (const [curie, specName] of Object.entries(SPEC_FIELD_NAMES)) {
    const value = instance[curie]
    if (value === undefined || value === null || value === "") continue
    if (Array.isArray(value) && value.length === 0) continue
    kit[specName] = value
  }

  // `description` is not modelled separately: the specification defers to
  // the semantic model, which always carries dcterms:description.
  if (!kit.description && typeof instance["dcterms:description"] === "string") {
    kit.description = instance["dcterms:description"]
  }

  // Same for the contact: fall back to dcat:contactPoint when it holds a
  // mail address and the operational field was left empty.
  if (!kit.contact_email) {
    const contact = instance["dcat:contactPoint"]
    if (typeof contact === "string") {
      const stripped = contact.trim().replace(/^mailto:/, "")
      if (EMAIL_PATTERN.test(stripped)) kit.contact_email = stripped
    }
  }

  // The specification asks for a bare address; the RODEOS field is a URI, so
  // a mailto: form is valid input that has to be unwrapped here.
  if (typeof kit.contact_email === "string") {
    kit.contact_email = kit.contact_email.trim().replace(/^mailto:/, "")
  }

  return kit
}

/**
 * Asset properties for the dataspace offer. The KIT specification's fields
 * are written flat (what a KIT builder reads), plus a nested copy and a
 * string copy.
 *
 * The string copy is not redundant: the EDC compacts single-element arrays
 * to scalars, so a `hardware_requirements` list with exactly one entry
 * arrives as an object while two entries arrive as an array. Consumers that
 * cannot handle both shapes parse `kitMetadataJson` instead.
 */
export function kitAssetProperties(
  instance: Record<string, unknown>
): Record<string, unknown> {
  const kit = buildKitMetadata(instance)
  if (!kit) return {}
  return {
    ...kit,
    kitMetadata: kit,
    kitMetadataJson: JSON.stringify(kit),
  }
}

/** Human-readable summary, e.g. "container · 3 requirements". */
export function describeKitMetadata(kit: KitMetadata | null): string {
  if (!kit) return "no operational type set"
  const requirements = (
    ["hardware_requirements", "software_requirements", "dataspace_requirements"] as const
  ).reduce((total, key) => {
    const value = kit[key]
    return total + (Array.isArray(value) ? (value as Requirement[]).length : 0)
  }, 0)
  const type = String(kit.operational_type ?? "unknown")
  return requirements > 0
    ? `${type} · ${requirements} requirement${requirements === 1 ? "" : "s"}`
    : type
}
