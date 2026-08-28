"use client"

import { ArrowDownLeftIcon, SparklesIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { RequirementEditor } from "@/components/rodeos/requirement-editor"
import { parseFieldType, type Requirement } from "@/lib/semantic-model"
import { cn } from "@/lib/utils"

export interface FieldInputProps {
  name: string
  fieldType: string
  required: boolean
  value: unknown
  error?: string
  /**
   * "missing"   → mandatory field without a value (red outline)
   * "suggested" → value is an unverified LLM proposal (amber outline)
   */
  status?: "missing" | "suggested"
  /**
   * Set when the value was taken over from a field of the semantic axis
   * (e.g. rodeos:fileSize ← dcat:byteSize) — shown as a hint.
   */
  derivedFrom?: string
  onChange: (raw: unknown) => void
}

const SUGGESTED_CLASS =
  "border-(--rox-gold) ring-3 ring-(--rox-gold)/30 dark:border-(--rox-gold)"

/** Multi-enum raw state is an array; tolerate the comma string form too. */
function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String)
  return String(value ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean)
}

export function FieldInput({
  name,
  fieldType,
  required,
  value,
  error,
  status,
  derivedFrom,
  onChange,
}: FieldInputProps) {
  const parsed = parseFieldType(fieldType)
  const id = `field-${name.replace(/[^a-zA-Z0-9]/g, "-")}`
  const invalid = Boolean(error) || status === "missing"
  const statusClass = status === "suggested" ? SUGGESTED_CLASS : undefined

  // Requirement lists carry their own layout and label.
  if (parsed.kind === "requirement") {
    return (
      <RequirementEditor
        name={name}
        namespace={parsed.namespace ?? "hardware"}
        value={Array.isArray(value) ? (value as Requirement[]) : []}
        error={error}
        status={status}
        onChange={onChange}
      />
    )
  }

  let control: React.ReactNode

  if (parsed.kind === "boolean" && !parsed.isList) {
    control = (
      <div className="flex h-8 items-center gap-2">
        <Checkbox
          id={id}
          checked={value === true}
          onCheckedChange={(checked) => onChange(checked === true)}
          className={statusClass}
        />
        <span className="text-sm text-muted-foreground">
          {value === true ? "true" : "false"}
        </span>
      </div>
    )
  } else if (parsed.kind === "enum" && parsed.isList) {
    // set<enum> (e.g. container platforms): pick any number of literals.
    const selected = toStringArray(value)
    control = (
      <div
        role="group"
        aria-label={name}
        className={cn(
          "flex flex-col gap-1.5 rounded-md border p-2",
          status === "suggested" && SUGGESTED_CLASS,
          invalid && "border-destructive"
        )}
      >
        {parsed.enumValues.map((option) => (
          <label
            key={option}
            className="flex items-center gap-2 text-sm font-normal"
          >
            <Checkbox
              checked={selected.includes(option)}
              onCheckedChange={(checked) =>
                onChange(
                  checked === true
                    ? [...selected, option]
                    : selected.filter((v) => v !== option)
                )
              }
            />
            <span className="font-mono text-xs">{option}</span>
          </label>
        ))}
      </div>
    )
  } else if (parsed.kind === "enum") {
    control = (
      <Select
        value={typeof value === "string" && value ? value : null}
        onValueChange={(v) => onChange(v ?? "")}
      >
        <SelectTrigger
          id={id}
          className={cn("w-full", statusClass)}
          aria-invalid={invalid}
        >
          <SelectValue placeholder="Select…" />
        </SelectTrigger>
        <SelectContent>
          {parsed.enumValues.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  } else if (parsed.kind === "jsonOrUri") {
    // request_schema / response_schema: a URL or the schema document itself.
    const text =
      typeof value === "string"
        ? value
        : value
          ? JSON.stringify(value, null, 2)
          : ""
    control = (
      <Textarea
        id={id}
        value={text}
        onChange={(e) => onChange(e.target.value)}
        placeholder={parsed.placeholder}
        aria-invalid={invalid}
        className={cn("min-h-16 font-mono text-xs", statusClass)}
      />
    )
  } else if (parsed.isList) {
    control = (
      <Textarea
        id={id}
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Comma-separated values"
        aria-invalid={invalid}
        className={cn("min-h-16", statusClass)}
      />
    )
  } else {
    control = (
      <Input
        id={id}
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={parsed.placeholder || `Enter ${name.split(":").pop()}`}
        aria-invalid={invalid}
        className={statusClass}
      />
    )
  }

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label
        htmlFor={id}
        className="flex min-w-0 flex-nowrap items-center gap-1.5 overflow-hidden"
      >
        <span
          className={cn(
            "shrink-0 font-medium",
            required &&
              "after:ml-0.5 after:text-(--rox-pink) after:content-['*']"
          )}
        >
          {name}
        </span>
        <Badge
          variant="outline"
          title={parsed.raw}
          className="block h-4 min-w-0 truncate rounded px-1 font-mono text-[10px] leading-[14px] font-normal text-muted-foreground"
        >
          {parsed.raw}
        </Badge>
      </Label>
      {control}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : status === "suggested" ? (
        <p className="inline-flex items-center gap-1 text-xs text-(--rox-gold)">
          <SparklesIcon className="size-3" />
          AI suggestion — please verify
        </p>
      ) : status === "missing" ? (
        <p className="text-xs text-destructive/80">Required — still empty</p>
      ) : derivedFrom ? (
        <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <ArrowDownLeftIcon className="size-3" />
          taken from <span className="font-mono">{derivedFrom}</span>
        </p>
      ) : null}
    </div>
  )
}
