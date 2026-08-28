"use client"

import * as React from "react"
import Link from "next/link"
import { SettingsIcon, SparklesIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { DocDropzone } from "@/components/rodeos/doc-dropzone"
import { instanceLabel } from "@/lib/semantic-model"
import type { ApplySummary } from "@/components/rodeos/model-form"

export interface AutofillResponse {
  path: string[]
  proposedPath: string[]
  values: Record<string, unknown>
  suggestions: Record<string, unknown>
  provider: string
  providerId: string
  model: string
}

interface ProviderInfo {
  id: string
  label: string
  kind: "openai" | "openrouter" | "ollama"
  model: string
  hasApiKey: boolean
}

interface AppConfig {
  providers: ProviderInfo[]
  defaultProviderId: string
}

export function AssistPanel({
  onApply,
}: {
  onApply: (result: AutofillResponse) => ApplySummary
}) {
  const [config, setConfig] = React.useState<AppConfig | null>(null)
  const [provider, setProvider] = React.useState("")
  const [model, setModel] = React.useState("")
  const [text, setText] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [summary, setSummary] = React.useState<
    (ApplySummary & { model: string; provider: string }) | null
  >(null)

  React.useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((cfg: AppConfig) => {
        setConfig(cfg)
        const active =
          cfg.providers.find((p) => p.id === cfg.defaultProviderId) ??
          cfg.providers[0]
        setProvider(active?.id ?? "")
        setModel(active?.model ?? "")
      })
      .catch(() => setError("Could not load LLM configuration"))
  }, [])

  const activeProvider = config?.providers.find((p) => p.id === provider) ?? null

  const switchProvider = (id: string) => {
    setProvider(id)
    const next = config?.providers.find((p) => p.id === id)
    if (next) setModel(next.model)
  }

  const run = async () => {
    setLoading(true)
    setError(null)
    setSummary(null)
    try {
      const res = await fetch("/api/autofill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, provider, model }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`)
      const applied = onApply(data as AutofillResponse)
      setSummary({ ...applied, model: data.model, provider: data.provider })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5 text-(--rox-blue-deep) dark:text-(--rox-blue-soft)">
          <SparklesIcon className="size-4 text-(--rox-pink)" />
          AI autofill
        </CardTitle>
        <CardDescription>
          Upload a technical document — PDFs are converted to markdown by the
          LLM first — or paste the text directly. The model then classifies
          the asset and fills the form.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <DocDropzone
          provider={provider}
          model={model}
          onText={(t) => {
            setText(t)
            setSummary(null)
          }}
          onClear={() => setText("")}
        />

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="assist-text" className="text-xs text-muted-foreground">
            Document text
          </Label>
          <Textarea
            id="assist-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="…or paste the technical documentation here"
            className="max-h-64 min-h-28 font-mono text-xs"
          />
        </div>

        <Separator />

        <div className="grid grid-cols-[8.5rem_minmax(0,1fr)] gap-2">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Provider</Label>
            <Select
              value={provider || null}
              onValueChange={(v) => v && switchProvider(v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select…">
                  {(id: string | null) =>
                    config?.providers.find((p) => p.id === id)?.label ??
                    "Select…"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(config?.providers ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Model</Label>
            <Input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="font-mono text-xs"
            />
          </div>
        </div>

        {activeProvider &&
          activeProvider.kind !== "ollama" &&
          !activeProvider.hasApiKey && (
            <p className="text-xs text-(--rox-pink)">
              No API key configured for {activeProvider.label} — add one under{" "}
              <Link href="/settings" className="underline underline-offset-2">
                Settings
              </Link>
              .
            </p>
          )}

        <Link
          href="/settings"
          className="inline-flex w-fit items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          <SettingsIcon className="size-3" />
          Manage providers and endpoints
        </Link>

        <Button onClick={run} disabled={loading || !text.trim()}>
          {loading ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <SparklesIcon data-icon="inline-start" />
          )}
          {loading ? "Analyzing…" : "Autofill from document"}
        </Button>

        {error && <p className="text-xs text-destructive">{error}</p>}

        {summary && (
          <div className="rounded-lg border border-(--rox-teal)/40 bg-(--rox-teal)/5 p-3 text-xs leading-relaxed">
            <p className="font-medium text-(--rox-teal)">
              Applied via {summary.provider} · {summary.model}
            </p>
            <p className="mt-1">
              <span className="text-muted-foreground">Classified as:</span>{" "}
              {summary.path.length
                ? summary.path.map(instanceLabel).join(" → ")
                : "no hierarchy match"}
            </p>
            <p>
              <span className="text-muted-foreground">Delivered as:</span>{" "}
              {summary.operationalPath.length
                ? summary.operationalPath.map(instanceLabel).join(" → ")
                : "no operational type proposed"}
            </p>
            <p>
              <span className="text-muted-foreground">Fields filled:</span>{" "}
              {summary.applied.length}
              {summary.suggested.length > 0 && (
                <span className="text-(--rox-gold)">
                  {" "}
                  · {summary.suggested.length} AI suggestion
                  {summary.suggested.length === 1 ? "" : "s"} to verify (amber)
                </span>
              )}
              {summary.skipped.length > 0 && (
                <span className="text-muted-foreground">
                  {" "}
                  · ignored (not in schema): {summary.skipped.join(", ")}
                </span>
              )}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
