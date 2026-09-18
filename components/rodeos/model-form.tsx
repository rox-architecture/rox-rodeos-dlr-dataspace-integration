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
import { deriveOperationalValues } from "@/lib/kit-metadata"
import {
  autoSelectorValuesForPath,
  collectFieldsForPath,
  computeLevels,
  instanceLabel,
  OPERATIONAL_AXIS,
  parseFieldType,
  pathKey,
  sanitizePath,
  SEMANTIC_AXIS,
  validateField,
  type FieldMap,
  type Level,
} from "@/lib/semantic-model"

export interface ApplySummary {
  path: string[]
  operationalPath: string[]
  applied: string[]
  suggested: string[]
  skipped: string[]
}

type RawValues = Record<string, unknown>

function toRawValue(fieldType: string, value: unknown): unknown {
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

/** Merge the mandatory/optional/default field maps of a level chain. */
function mergeLevels(levels: Level[]) {
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

export function ModelForm() {
  const [values, setValues] = React.useState<RawValues>({})
  const [selections, setSelections] = React.useState<Record<string, string>>({})
  // Fields whose current value is an unverified LLM proposal (shown amber
  // until the user confirms by editing or re-entering the value).
  const [suggested, setSuggested] = React.useState<ReadonlySet<string>>(
    new Set()
  )

  // The two axes: what the asset is, and how it is delivered.
  const semanticLevels = React.useMemo(
    () => computeLevels(values, selections, SEMANTIC_AXIS),
    [values, selections]
  )
  const operationalLevels = React.useMemo(
    () => computeLevels(values, selections, OPERATIONAL_AXIS),
    [values, selections]
  )

  // Fields visible on both active paths, in level order.
  const visibleFields = React.useMemo(() => {
    const semantic = mergeLevels(semanticLevels)
    const operational = mergeLevels(operationalLevels)
    return {
      mandatory: { ...semantic.mandatory, ...operational.mandatory },
      optional: { ...semantic.optional, ...operational.optional },
      defaults: { ...semantic.defaults, ...operational.defaults },
    }
  }, [semanticLevels, operationalLevels])

  // Operational fields the semantic axis already answers (file size, format,
  // contact …). They behave like model defaults: a fallback the user can
  // always overrule.
  const derived = React.useMemo(
    () => deriveOperationalValues({ ...visibleFields.defaults, ...values }),
    [visibleFields, values]
  )

  // Model-declared defaultValues and derivations act as fallbacks for
  // untouched fields; any user input (including clearing a field) wins.
  const effectiveValues = React.useMemo<RawValues>(() => {
    const merged: RawValues = { ...visibleFields.defaults }
    for (const [name, entry] of Object.entries(derived)) {
      merged[name] = entry.value
    }
    return { ...merged, ...values }
  }, [visibleFields, derived, values])

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
      // Pass 1: the form state that reproduces the path the LLM named.
      const derivedFromPath = autoSelectorValuesForPath(result.path)
      const nextValues: RawValues = { ...derivedFromPath.values }
      const nextSelections: Record<string, string> = {
        ...derivedFromPath.selections,
      }

      // Pass 2: an auto-selector value the LLM supplied for a level the path
      // left open (e.g. rodeos:softwareAssetType when result.path stops at
      // softwareComponent) takes the hierarchy deeper. The path is therefore
      // resolved from the combined state before the known fields are read.
      const suggestedSelectors: string[] = []
      for (const name of SEMANTIC_AXIS.autoSelectors) {
        if (name in nextValues) continue
        const v = result.values?.[name] ?? result.suggestions?.[name]
        if (typeof v !== "string" || !v) continue
        nextValues[name] = v
        if (result.values?.[name] === undefined) suggestedSelectors.push(name)
      }
      const resolvedPath = computeLevels(
        nextValues,
        nextSelections,
        SEMANTIC_AXIS
      ).at(-1)!.path
      const fields = collectFieldsForPath(resolvedPath)

      // The operational axis is auto-selected by rodeos:operationalType, so
      // its path follows from the value the model proposed.
      const proposedType =
        result.values?.["rodeos:operationalType"] ??
        result.suggestions?.["rodeos:operationalType"]
      const operationalPath =
        typeof proposedType === "string" && proposedType
          ? sanitizePath([`rodeos:${proposedType}`], OPERATIONAL_AXIS)
          : []
      const operationalFields = collectFieldsForPath(
        operationalPath,
        OPERATIONAL_AXIS
      )

      const known = {
        ...fields.mandatory,
        ...fields.optional,
        ...operationalFields.mandatory,
        ...operationalFields.optional,
      }

      // A pass-2 selector no level on the resolved path asks for is reported
      // as skipped below and must not linger in the form state.
      for (const name of SEMANTIC_AXIS.autoSelectors) {
        if (!(name in derivedFromPath.values) && !(name in known)) {
          delete nextValues[name]
        }
      }

      const applied: string[] = []
      const suggestedNames: string[] = []
      const skipped: string[] = []
      for (const [name, value] of Object.entries(result.values ?? {})) {
        if (name in derivedFromPath.values) continue
        if (!(name in known)) {
          skipped.push(name)
          continue
        }
        nextValues[name] = toRawValue(known[name], value)
        applied.push(name)
      }

      // Unverified LLM proposals — filled in, but flagged for review.
      for (const [name, value] of Object.entries(result.suggestions ?? {})) {
        if (name in derivedFromPath.values) continue
        if (!(name in known)) {
          skipped.push(name)
          continue
        }
        if (nextValues[name] !== undefined) continue
        nextValues[name] = toRawValue(known[name], value)
        suggestedNames.push(name)
      }
      // Pass-2 selectors taken from the suggestions are already set, so the
      // loop above skipped them; they still need the amber marker.
      suggestedNames.push(
        ...suggestedSelectors.filter((name) => name in known)
      )

      // Model defaults for the chosen paths (unless the LLM provided a value).
      for (const [name, def] of Object.entries({
        ...fields.defaults,
        ...operationalFields.defaults,
      })) {
        if (nextValues[name] === undefined) nextValues[name] = def
      }

      setValues(nextValues)
      setSelections(nextSelections)
      setSuggested(new Set(suggestedNames))
      return {
        path: resolvedPath,
        operationalPath,
        applied,
        suggested: suggestedNames,
        skipped,
      }
    },
    []
  )

  const onSelectChild = React.useCallback((level: Level, child: string) => {
    setSelections((prev) => ({
      ...prev,
      [pathKey(level.path, level.axis)]: child,
    }))
  }, [])

  const allLevels = [...semanticLevels, ...operationalLevels]

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] xl:grid-cols-[minmax(0,1fr)_minmax(0,32rem)] 2xl:grid-cols-[minmax(0,1fr)_minmax(0,38rem)]">
      <div className="flex min-w-0 flex-col gap-4">
        {allLevels.map((level, i) => (
          <LevelCard
            key={`${level.axis}-${pathKey(level.path) || "root"}`}
            level={level}
            index={i}
            values={effectiveValues}
            errors={errors}
            missing={missingSet}
            suggested={suggested}
            derived={derived}
            onFieldChange={setField}
            onSelectChild={(child) => onSelectChild(level, child)}
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
  derived,
  onFieldChange,
  onSelectChild,
}: {
  level: Level
  index: number
  values: RawValues
  errors: Record<string, string>
  missing: ReadonlySet<string>
  suggested: ReadonlySet<string>
  derived: Record<string, { value: unknown; source: string }>
  onFieldChange: (name: string, raw: unknown) => void
  onSelectChild: (child: string) => void
}) {
  const statusOf = (name: string): "suggested" | "missing" | undefined =>
    suggested.has(name) ? "suggested" : missing.has(name) ? "missing" : undefined
  // The hint only applies while the user has not overridden the value.
  const derivedFrom = (name: string): string | undefined =>
    values[name] === derived[name]?.value ? derived[name]?.source : undefined
  const [showOptional, setShowOptional] = React.useState(false)
  const isOperational = level.axis === "operational"
  const isRoot = level.path.length === 0

  // Requirement editors are rows of controls — they get the full card width
  // instead of a cell in the field grid.
  const split = (entries: Array<[string, string]>) => {
    const grid: Array<[string, string]> = []
    const wide: Array<[string, string]> = []
    for (const entry of entries) {
      ;(parseFieldType(entry[1]).kind === "requirement" ? wide : grid).push(entry)
    }
    return { grid, wide }
  }

  const mandatory = split(Object.entries(level.node.mandatory ?? {}))
  const optional = split(Object.entries(level.node.optional ?? {}))
  const optionalCount = optional.grid.length + optional.wide.length

  const title = isRoot
    ? isOperational
      ? "Operational profile (KIT metadata)"
      : "Basic resource information"
    : instanceLabel(level.path[level.path.length - 1])
  // Only useful once it says more than the card title does.
  const breadcrumb =
    level.path.length > 1 ? level.path.map(instanceLabel).join(" → ") : ""

  const renderField = ([name, type]: [string, string], required: boolean) => (
    <FieldInput
      key={name}
      name={name}
      fieldType={type}
      required={required}
      value={values[name]}
      error={errors[name]}
      status={statusOf(name)}
      derivedFrom={derivedFrom(name)}
      onChange={(raw) => onFieldChange(name, raw)}
    />
  )

  return (
    <Card className={isOperational ? "border-(--rox-teal)/40" : undefined}>
      <CardHeader>
        <CardTitle
          className={
            isOperational
              ? "flex items-baseline gap-2 text-(--rox-teal)"
              : "flex items-baseline gap-2 text-(--rox-blue-deep) dark:text-(--rox-blue-soft)"
          }
        >
          <span className="font-mono text-xs text-(--rox-pink)">
            {String(index + 1).padStart(2, "0")}
          </span>
          {title}
        </CardTitle>
        {isRoot && isOperational ? (
          <CardDescription>
            How the asset is delivered and invoked — independent of what it is.
            KIT builders compose assets from these fields. A physical component
            is catalogued as its description, i.e. a static file.
          </CardDescription>
        ) : isRoot ? (
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
        {mandatory.grid.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {mandatory.grid.map((entry) => renderField(entry, true))}
          </div>
        )}
        {mandatory.wide.map((entry) => renderField(entry, true))}

        {optionalCount > 0 && (
          <div className="flex flex-col gap-4">
            <button
              type="button"
              onClick={() => setShowOptional((v) => !v)}
              className="w-fit text-left text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase transition-colors hover:text-foreground"
            >
              {showOptional ? "− Hide" : "+ Show"} optional fields ({optionalCount})
            </button>
            {showOptional && (
              <>
                {optional.grid.length > 0 && (
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                    {optional.grid.map((entry) => renderField(entry, false))}
                  </div>
                )}
                {optional.wide.map((entry) => renderField(entry, false))}
              </>
            )}
          </div>
        )}

        {level.selectionOptions && (
          <>
            {(mandatory.grid.length > 0 || optionalCount > 0) && <Separator />}
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
                  <SelectValue placeholder="Choose the specific type…">
                    {(key: string | null) =>
                      key ? instanceLabel(key) : "Choose the specific type…"
                    }
                  </SelectValue>
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
