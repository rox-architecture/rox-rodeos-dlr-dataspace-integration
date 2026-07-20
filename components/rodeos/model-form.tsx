"use client"

import * as React from "react"
import { RotateCcwIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { FieldInput } from "@/components/rodeos/field-input"
import { AssistPanel, type AutofillResponse } from "@/components/rodeos/assist-panel"
import { JsonPreview } from "@/components/rodeos/json-preview"
import {
  collectFieldsForPath,
  computeLevels,
  instanceLabel,
  parseFieldType,
  pathKey,
  validateField,
  type FieldMap,
  type Level,
} from "@/lib/semantic-model"

export interface ApplySummary {
  path: string[]
  applied: string[]
  suggested: string[]
  skipped: string[]
}

type RawValues = Record<string, unknown>

function toRawValue(fieldType: string, value: unknown): unknown {
  const parsed = parseFieldType(fieldType)
  if (parsed.kind === "boolean" && !parsed.isList) {
    if (typeof value === "boolean") return value
    return String(value).toLowerCase() === "true"
  }
  if (parsed.isList && Array.isArray(value)) return value.join(", ")
  return String(value)
}

export function ModelForm() {
  const [values, setValues] = React.useState<RawValues>({})
  const [selections, setSelections] = React.useState<Record<string, string>>({})
  // Fields whose current value is an unverified LLM proposal (shown amber
  // until the user confirms by editing or re-entering the value).
  const [suggested, setSuggested] = React.useState<ReadonlySet<string>>(
    new Set()
  )

  const levels = React.useMemo(
    () => computeLevels(values, selections),
    [values, selections]
  )

  // Fields visible on the active path, in level order.
  const visibleFields = React.useMemo(() => {
    const mandatory: FieldMap = {}
    const optional: FieldMap = {}
    const defaults: Record<string, string> = {}
    for (const level of levels) {
      Object.assign(mandatory, level.node.mandatory ?? {})
      Object.assign(optional, level.node.optional ?? {})
      Object.assign(defaults, level.node.defaultValues ?? {})
    }
    return { mandatory, optional, defaults }
  }, [levels])

  // Model-declared defaultValues act as fallbacks for untouched fields;
  // any user input (including clearing a field) takes precedence.
  const effectiveValues = React.useMemo<RawValues>(
    () => ({ ...visibleFields.defaults, ...values }),
    [visibleFields, values]
  )

  // Validate all visible fields and build the output document.
  const { output, errors, missingMandatory } = React.useMemo(() => {
    const output: Record<string, unknown> = {}
    const errors: Record<string, string> = {}
    const missingMandatory: string[] = []
    const all: Array<[string, string, boolean]> = [
      ...Object.entries(visibleFields.mandatory).map(
        ([n, t]) => [n, t, true] as [string, string, boolean]
      ),
      ...Object.entries(visibleFields.optional).map(
        ([n, t]) => [n, t, false] as [string, string, boolean]
      ),
    ]
    for (const [name, type, required] of all) {
      const res = validateField(type, effectiveValues[name])
      if (!res.ok) {
        errors[name] = res.error ?? "Invalid value"
        if (required) missingMandatory.push(name)
        continue
      }
      if (res.value === undefined) {
        // An untouched mandatory checkbox counts as false, not as missing.
        const parsed = parseFieldType(type)
        if (parsed.kind === "boolean" && !parsed.isList && required) {
          output[name] = false
          continue
        }
        if (required) missingMandatory.push(name)
        continue
      }
      output[name] = res.value
    }
    return { output, errors, missingMandatory }
  }, [visibleFields, effectiveValues])

  const setField = React.useCallback((name: string, raw: unknown) => {
    setValues((prev) => ({ ...prev, [name]: raw }))
    // Editing a field confirms (or replaces) an LLM suggestion.
    setSuggested((prev) => {
      if (!prev.has(name)) return prev
      const next = new Set(prev)
      next.delete(name)
      return next
    })
  }, [])

  const reset = React.useCallback(() => {
    setValues({})
    setSelections({})
    setSuggested(new Set())
  }, [])

  const missingSet = React.useMemo(
    () => new Set(missingMandatory),
    [missingMandatory]
  )

  /** Apply an LLM autofill result: select the hierarchy path, then set values. */
  const applyAutofill = React.useCallback(
    (result: AutofillResponse): ApplySummary => {
      const path = result.path
      const fields = collectFieldsForPath(path)
      const known = { ...fields.mandatory, ...fields.optional }

      const nextValues: RawValues = {}
      const nextSelections: Record<string, string> = {}

      // Derive auto-selector fields + manual selections from the path.
      const walked: string[] = []
      for (const key of path) {
        const short = key.replace(/^rodeos:/, "")
        if (walked.length === 0) {
          nextValues["rodeos:coreType"] = short
        } else if (short === "hardwareComponent" || short === "softwareComponent") {
          nextValues["rodeos:componentType"] = short
        } else {
          nextSelections[pathKey(walked)] = key
        }
        walked.push(key)
      }

      const applied: string[] = []
      const suggestedNames: string[] = []
      const skipped: string[] = []
      for (const [name, value] of Object.entries(result.values ?? {})) {
        if (name === "rodeos:coreType" || name === "rodeos:componentType") continue
        if (!(name in known)) {
          skipped.push(name)
          continue
        }
        nextValues[name] = toRawValue(known[name], value)
        applied.push(name)
      }

      // Unverified LLM proposals — filled in, but flagged for review.
      for (const [name, value] of Object.entries(result.suggestions ?? {})) {
        if (name === "rodeos:coreType" || name === "rodeos:componentType") continue
        if (!(name in known)) {
          skipped.push(name)
          continue
        }
        if (nextValues[name] !== undefined) continue
        nextValues[name] = toRawValue(known[name], value)
        suggestedNames.push(name)
      }

      // Model defaults for the chosen path (unless the LLM provided a value).
      for (const [name, def] of Object.entries(fields.defaults)) {
        if (nextValues[name] === undefined) nextValues[name] = def
      }

      setValues(nextValues)
      setSelections(nextSelections)
      setSuggested(new Set(suggestedNames))
      return { path, applied, suggested: suggestedNames, skipped }
    },
    []
  )

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] xl:grid-cols-[minmax(0,1fr)_minmax(0,32rem)] 2xl:grid-cols-[minmax(0,1fr)_minmax(0,38rem)]">
      <div className="flex min-w-0 flex-col gap-4">
        {levels.map((level, i) => (
          <LevelCard
            key={pathKey(level.path) || "root"}
            level={level}
            index={i}
            values={effectiveValues}
            errors={errors}
            missing={missingSet}
            suggested={suggested}
            onFieldChange={setField}
            onSelectChild={(child) =>
              setSelections((prev) => ({
                ...prev,
                [pathKey(level.path)]: child,
              }))
            }
          />
        ))}
        <div>
          <Button variant="outline" onClick={reset}>
            <RotateCcwIcon data-icon="inline-start" />
            Reset form
          </Button>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
        <AssistPanel onApply={applyAutofill} />
        <JsonPreview
          data={output}
          missingMandatory={missingMandatory}
          suggested={[...suggested]}
          invalidCount={Object.keys(errors).length}
        />
      </div>
    </div>
  )
}

function LevelCard({
  level,
  index,
  values,
  errors,
  missing,
  suggested,
  onFieldChange,
  onSelectChild,
}: {
  level: Level
  index: number
  values: RawValues
  errors: Record<string, string>
  missing: ReadonlySet<string>
  suggested: ReadonlySet<string>
  onFieldChange: (name: string, raw: unknown) => void
  onSelectChild: (child: string) => void
}) {
  const statusOf = (name: string): "suggested" | "missing" | undefined =>
    suggested.has(name) ? "suggested" : missing.has(name) ? "missing" : undefined
  const [showOptional, setShowOptional] = React.useState(false)
  const mandatory = Object.entries(level.node.mandatory ?? {})
  const optional = Object.entries(level.node.optional ?? {})
  const isRoot = level.path.length === 0

  const title = isRoot
    ? "Basic resource information"
    : instanceLabel(level.path[level.path.length - 1])
  const breadcrumb = level.path.map(instanceLabel).join(" → ")

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-baseline gap-2 text-(--rox-blue-deep) dark:text-(--rox-blue-soft)">
          <span className="font-mono text-xs text-(--rox-pink)">
            {String(index + 1).padStart(2, "0")}
          </span>
          {title}
        </CardTitle>
        {isRoot ? (
          <CardDescription>
            Mandatory DCAT resource metadata — the core type determines all
            further steps.
          </CardDescription>
        ) : breadcrumb ? (
          <CardDescription className="font-mono text-xs">
            {breadcrumb}
          </CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {mandatory.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {mandatory.map(([name, type]) => (
              <FieldInput
                key={name}
                name={name}
                fieldType={type}
                required
                value={values[name]}
                error={errors[name]}
                status={statusOf(name)}
                onChange={(raw) => onFieldChange(name, raw)}
              />
            ))}
          </div>
        )}

        {optional.length > 0 && (
          <div className="flex flex-col gap-4">
            <button
              type="button"
              onClick={() => setShowOptional((v) => !v)}
              className="w-fit text-left text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase transition-colors hover:text-foreground"
            >
              {showOptional ? "− Hide" : "+ Show"} optional fields ({optional.length})
            </button>
            {showOptional && (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {optional.map(([name, type]) => (
                  <FieldInput
                    key={name}
                    name={name}
                    fieldType={type}
                    required={false}
                    value={values[name]}
                    error={errors[name]}
                    status={statusOf(name)}
                    onChange={(raw) => onFieldChange(name, raw)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {level.selectionOptions && (
          <>
            {(mandatory.length > 0 || optional.length > 0) && <Separator />}
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">
                Sub-type
                <span className="ml-0.5 text-(--rox-pink)">*</span>
              </span>
              <Select
                value={level.selectedChild}
                onValueChange={(v) => v && onSelectChild(v)}
              >
                <SelectTrigger
                  className="w-full sm:w-1/2 xl:w-1/3"
                  aria-invalid={!level.selectedChild}
                >
                  <SelectValue placeholder="Choose the specific type…" />
                </SelectTrigger>
                <SelectContent>
                  {level.selectionOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {instanceLabel(option)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
