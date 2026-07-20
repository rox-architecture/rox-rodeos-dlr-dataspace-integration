"use client"

import { SparklesIcon } from "lucide-react"

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
import { parseFieldType } from "@/lib/semantic-model"
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
  onChange: (raw: unknown) => void
}

const SUGGESTED_CLASS =
  "border-(--rox-gold) ring-3 ring-(--rox-gold)/30 dark:border-(--rox-gold)"

export function FieldInput({
  name,
  fieldType,
  required,
  value,
  error,
  status,
  onChange,
}: FieldInputProps) {
  const parsed = parseFieldType(fieldType)
  const id = `field-${name.replace(/[^a-zA-Z0-9]/g, "-")}`
  const invalid = Boolean(error) || status === "missing"
  const statusClass = status === "suggested" ? SUGGESTED_CLASS : undefined

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
  } else if (parsed.kind === "enum" && !parsed.isList) {
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
      ) : null}
    </div>
  )
}
