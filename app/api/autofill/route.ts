import {
  chatCompletion,
  extractJson,
  resolveConfig,
  type ChatMessage,
} from "@/lib/llm"
import {
  collectFieldsForPath,
  sanitizePath,
  semanticModel,
} from "@/lib/semantic-model"

interface AutofillRequest {
  text?: string
  provider?: string
  model?: string
}

interface AutofillResult {
  path: string[]
  values: Record<string, unknown>
  suggestions: Record<string, unknown>
}

const SYSTEM_PROMPT = `You are an expert in industrial robotics and semantic data modeling.
You extract structured metadata from technical documentation (datasheets, manuals, service descriptions) and map it onto the RODEOS semantic model, which extends W3C DCAT-3.

The RODEOS semantic model is a hierarchy: a dcat:Resource is classified via "rodeos:coreType" as Dataset, Component or Service. Components split into hardware/software via "rodeos:componentType", then into ever more specific sub-types via the "instances" keys of the model.

You always answer with a single JSON object and nothing else — no prose, no markdown fences.`

function buildUserPrompt(text: string): string {
  return `Below is (1) the RODEOS semantic model and (2) a technical document.

Task:
1. Decide which hierarchy path in the semantic model fits the documented asset best. Express it as the list of "instances" keys from dcat:Resource downwards, e.g. ["rodeos:Component", "rodeos:hardwareComponent", "rodeos:roboter", "rodeos:stationaryRobot", "rodeos:serielRobot", "rodeos:articulated"]. Only use keys that exist in the model, in parent-to-child order. Stop at the most specific level the document supports.
2. Fill in as many field values as the document allows, for every level on that path (mandatory fields first, optional where available). Use the exact field names from the model (e.g. "dcterms:title", "rodeos:payload").
3. Separate certainty levels: values the document clearly supports go into "values". For MANDATORY fields on the chosen path that the document does NOT explicitly state, provide a plausible proposal in "suggestions" when one can reasonably be inferred (e.g. dcat:version "1.0", a contact URL from the manufacturer's known website, a typical operating voltage for this device class). The user reviews every suggestion, so a sensible best guess is welcome — but NEVER place document-supported facts in "suggestions" and never place guesses in "values". Leave truly unknowable fields out entirely.

Rules for values:
- "rodeos:coreType" must be one of Dataset, Component, Service and must match the first path element.
- "rodeos:componentType" must be hardwareComponent or softwareComponent and must match the second path element when present.
- enum[...] fields: use exactly one of the listed literals.
- xsd:integer / xsd:decimal: plain numbers, no units. Convert units where needed (payload in kg, velocity in m/s, voltage in V, reach/dimensions in mm unless the field name implies otherwise).
- List[...] fields: JSON arrays.
- xsd:boolean: true/false.
- xsd:anyUri: full URLs only.
- Do NOT invent values that are not supported by the document. Omit unknown fields entirely — NEVER output a type string (like "xsd:text", "skos:concept", "xsd:anyUri") as a value. For "dcterms:identifier" you may derive a sensible slug from the product name. Do not include "rodeos:aasSubmodel" unless the document names one (the model has defaults).

Respond with exactly this JSON shape:
{
  "path": ["...", "..."],
  "values": { "fieldName": value, ... },
  "suggestions": { "fieldName": value, ... }
}

(1) RODEOS semantic model:
${JSON.stringify(semanticModel)}

(2) Technical document:
"""
${text}
"""`
}

export async function POST(request: Request) {
  let body: AutofillRequest
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const text = body.text?.trim()
  if (!text) {
    return Response.json(
      { error: "Field 'text' with document content is required" },
      { status: 400 }
    )
  }

  const config = resolveConfig(body.provider, body.model)

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: buildUserPrompt(text.slice(0, 60_000)) },
  ]

  try {
    let raw = await chatCompletion(config, messages)
    let parsed: AutofillResult | null = null

    for (let attempt = 0; attempt < 2 && !parsed; attempt++) {
      try {
        const candidate = extractJson(raw) as Partial<AutofillResult>
        if (candidate && typeof candidate === "object") {
          parsed = {
            path: Array.isArray(candidate.path)
              ? candidate.path.map(String)
              : [],
            values:
              candidate.values && typeof candidate.values === "object"
                ? (candidate.values as Record<string, unknown>)
                : {},
            suggestions:
              candidate.suggestions && typeof candidate.suggestions === "object"
                ? (candidate.suggestions as Record<string, unknown>)
                : {},
          }
        }
      } catch (err) {
        if (attempt === 0) {
          raw = await chatCompletion(config, [
            ...messages,
            { role: "assistant", content: raw },
            {
              role: "user",
              content: `Your previous answer could not be parsed as JSON (${String(
                err
              )}). Respond again with ONLY the JSON object, no other text.`,
            },
          ])
        } else {
          throw err
        }
      }
    }

    if (!parsed) {
      throw new Error("Model did not return a parsable JSON object")
    }

    const path = sanitizePath(parsed.path)

    // Drop hallucinated placeholder values: some models echo the field's
    // type string (e.g. "xsd:text", "skos:concept") instead of omitting
    // fields they could not extract.
    const TYPE_LITERAL = /^(xsd:|skos:|schema:|dcterms:|dcat:|rodeos:|enum\[|List\[)/
    const clean = (obj: Record<string, unknown>) =>
      Object.fromEntries(
        Object.entries(obj).filter(
          ([, v]) => !(typeof v === "string" && TYPE_LITERAL.test(v.trim()))
        )
      )
    const values = clean(parsed.values)
    const suggestions = clean(parsed.suggestions)
    // A field can only be one of the two — confident values win.
    for (const key of Object.keys(values)) delete suggestions[key]

    return Response.json({
      path,
      proposedPath: parsed.path,
      values,
      suggestions,
      fields: collectFieldsForPath(path),
      provider: config.provider,
      model: config.model,
    })
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    )
  }
}
