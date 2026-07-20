"use client"

import * as React from "react"
import {
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  SparklesIcon,
  TriangleAlertIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function JsonPreview({
  data,
  missingMandatory,
  suggested,
  invalidCount,
}: {
  data: Record<string, unknown>
  missingMandatory: string[]
  suggested: string[]
  invalidCount: number
}) {
  const [copied, setCopied] = React.useState(false)
  const json = JSON.stringify(data, null, 2)
  const complete = missingMandatory.length === 0 && invalidCount === 0
  const hasContent = Object.keys(data).length > 0

  const copy = async () => {
    await navigator.clipboard.writeText(json)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const download = () => {
    const blob = new Blob([json], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    const title = typeof data["dcterms:identifier"] === "string"
      ? String(data["dcterms:identifier"]).replace(/[^a-zA-Z0-9_-]+/g, "-")
      : "rodeos_semantic_instance"
    a.download = `${title || "rodeos_semantic_instance"}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-(--rox-blue-deep) dark:text-(--rox-blue-soft)">
          Generated instance
        </CardTitle>
        <CardDescription className="flex flex-col gap-0.5">
          {complete && hasContent ? (
            <span className="inline-flex items-center gap-1 text-(--rox-teal)">
              <CheckIcon className="size-3.5" /> All mandatory fields are valid
            </span>
          ) : (
            <span className="inline-flex items-center gap-1">
              <TriangleAlertIcon className="size-3.5 text-destructive" />
              {missingMandatory.length} mandatory field
              {missingMandatory.length === 1 ? "" : "s"} missing
              {invalidCount > 0 ? `, ${invalidCount} invalid` : ""}
            </span>
          )}
          {suggested.length > 0 && (
            <span className="inline-flex items-center gap-1 text-(--rox-gold)">
              <SparklesIcon className="size-3.5" />
              {suggested.length} AI suggestion{suggested.length === 1 ? "" : "s"} to
              verify
            </span>
          )}
        </CardDescription>
        <CardAction>
          <Button variant="outline" size="icon-sm" onClick={copy} title="Copy JSON">
            {copied ? <CheckIcon className="text-(--rox-teal)" /> : <CopyIcon />}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <pre className="max-h-[45vh] overflow-auto rounded-lg bg-muted p-3 font-mono text-xs leading-relaxed">
          {hasContent ? json : "// Fill the form or run the AI autofill"}
        </pre>
        {missingMandatory.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {missingMandatory.map((name) => (
              <Badge
                key={name}
                variant="outline"
                className="rounded border-destructive/40 font-mono text-[10px] font-normal text-destructive"
              >
                {name}
              </Badge>
            ))}
          </div>
        )}
        {suggested.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {suggested.map((name) => (
              <Badge
                key={name}
                variant="outline"
                className="rounded border-(--rox-gold)/60 font-mono text-[10px] font-normal text-(--rox-gold)"
              >
                {name}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button
          className="w-full bg-(--rox-blue-deep) text-white hover:bg-(--rox-blue) dark:bg-(--rox-blue-soft) dark:text-(--rox-blue-deep) dark:hover:bg-(--rox-blue-100)"
          size="lg"
          onClick={download}
          disabled={!hasContent}
        >
          <DownloadIcon data-icon="inline-start" />
          Download semantic model (JSON)
        </Button>
      </CardFooter>
    </Card>
  )
}
