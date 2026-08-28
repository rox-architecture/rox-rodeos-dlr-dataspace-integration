"use client"

import * as React from "react"
import { PlusIcon, SparklesIcon, XIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  REQUIREMENT_OPERATORS,
  REQUIREMENT_SUBJECTS,
  requirementToText,
  type Requirement,
} from "@/lib/semantic-model"
import { cn } from "@/lib/utils"

const CUSTOM = "__custom__"

export interface RequirementEditorProps {
  name: string
  /** "hardware" | "software" | "dataspace" — enforced as the subject prefix. */
  namespace: string
  value: Requirement[]
  error?: string
  /** "suggested" → the rows are an unverified LLM proposal (amber). */
  status?: "missing" | "suggested"
  onChange: (rows: Requirement[]) => void
}

function operatorSpec(operator: string) {
  return REQUIREMENT_OPERATORS.find((o) => o.operator === operator)
}

/**
 * Editor for the KIT specification's requirement DSL: one row per
 * requirement, each a subject / operator / value triple. Subjects are
 * suggested from the specification's namespace taxonomy but stay freely
 * editable, and any operator string is allowed — the six well-known ones
 * are just offered up front.
 */
export function RequirementEditor({
  name,
  namespace,
  value,
  error,
  status,
  onChange,
}: RequirementEditorProps) {
  const rows = value.length > 0 ? value : []
  const listId = `subjects-${namespace}`
  const suggestions = REQUIREMENT_SUBJECTS[namespace] ?? []

  const update = (index: number, patch: Partial<Requirement>) => {
    const next = rows.map((row, i) => (i === index ? { ...row, ...patch } : row))
    onChange(next)
  }

  const addRow = () =>
    onChange([...rows, { subject: `${namespace}.`, operator: "required" }])

  const removeRow = (index: number) =>
    onChange(rows.filter((_, i) => i !== index))

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <Label className="font-medium">{name}</Label>
        <Badge
          variant="outline"
          className="block h-4 rounded px-1 font-mono text-[10px] leading-[14px] font-normal text-muted-foreground"
        >
          {namespace} requirements
        </Badge>
        {status === "suggested" && (
          <span className="inline-flex items-center gap-1 text-xs text-(--rox-gold)">
            <SparklesIcon className="size-3" />
            AI suggestion — please verify
          </span>
        )}
      </div>

      <datalist id={listId}>
        {suggestions.map((subject) => (
          <option key={subject} value={subject} />
        ))}
      </datalist>

      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No {namespace} requirements — add one if consuming this asset depends
          on something.
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {rows.map((row, index) => {
            const spec = operatorSpec(row.operator)
            const isCustom = row.operator !== "" && !spec
            const needsValue = spec ? spec.needsValue : true
            return (
              <div key={index} className="flex flex-col gap-1">
                <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
                  <Input
                    value={row.subject}
                    list={listId}
                    onChange={(e) => update(index, { subject: e.target.value })}
                    placeholder={`${namespace}.…`}
                    aria-label="Subject"
                    className={cn(
                      "font-mono text-xs sm:flex-[3]",
                      status === "suggested" && "border-(--rox-gold)"
                    )}
                  />
                  {isCustom ? (
                    <Input
                      value={row.operator}
                      onChange={(e) =>
                        update(index, { operator: e.target.value })
                      }
                      placeholder="custom operator"
                      aria-label="Operator"
                      className="font-mono text-xs sm:flex-[2]"
                    />
                  ) : (
                    <Select
                      value={row.operator || null}
                      onValueChange={(v) => {
                        if (!v) return
                        if (v === CUSTOM) {
                          update(index, { operator: "" })
                          return
                        }
                        const next = operatorSpec(v)
                        update(index, {
                          operator: v,
                          ...(next && !next.needsValue ? { value: "" } : {}),
                        })
                      }}
                    >
                      <SelectTrigger
                        className="w-full font-mono text-xs sm:flex-[2]"
                        aria-label="Operator"
                      >
                        <SelectValue placeholder="operator" />
                      </SelectTrigger>
                      <SelectContent>
                        {REQUIREMENT_OPERATORS.map((op) => (
                          <SelectItem key={op.operator} value={op.operator}>
                            {op.hint}
                          </SelectItem>
                        ))}
                        <SelectItem value={CUSTOM}>custom…</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                  <div className="flex items-center gap-1 sm:flex-[3]">
                    <Input
                      value={row.value ?? ""}
                      onChange={(e) => update(index, { value: e.target.value })}
                      placeholder={
                        needsValue
                          ? row.operator === "in"
                            ? "{amd64, arm64}"
                            : "value"
                          : "— no value"
                      }
                      disabled={!needsValue}
                      aria-label="Value"
                      className="font-mono text-xs"
                    />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => removeRow(index)}
                      title="Remove requirement"
                      aria-label={`Remove requirement ${index + 1}`}
                    >
                      <XIcon />
                    </Button>
                  </div>
                </div>
                <p className="pl-1 font-mono text-[10px] text-muted-foreground">
                  → {requirementToText(row) || "…"}
                </p>
              </div>
            )
          })}
        </div>
      )}

      <div>
        <Button variant="outline" size="sm" onClick={addRow}>
          <PlusIcon data-icon="inline-start" />
          Add {namespace} requirement
        </Button>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
