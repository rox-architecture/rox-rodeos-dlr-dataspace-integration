"use client"

import * as React from "react"
import {
  CheckIcon,
  LockIcon,
  PlugZapIcon,
  PlusIcon,
  SaveIcon,
  TrashIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
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

type ProviderKind = "openai" | "openrouter" | "ollama"

interface Preset {
  label: string
  kind: ProviderKind
  baseUrl: string
  hint: string
}

interface PublicProvider {
  id: string
  label: string
  kind: ProviderKind
  baseUrl: string
  model: string
  builtin?: boolean
  hasApiKey: boolean
  apiKeyHint: string | null
  apiKeyFromEnv: boolean
}

interface SettingsResponse {
  providers: PublicProvider[]
  defaultProviderId: string
  locked: boolean
  settingsPath: string
  presets: Preset[]
}

interface Draft extends PublicProvider {
  /** Empty means "leave the stored key untouched". */
  apiKeyInput: string
  /** Set by the clear button — sends "" to delete the stored key. */
  clearKey: boolean
}

interface ProbeState {
  ok: boolean
  message: string
  models: string[]
}

const KIND_LABELS: Record<ProviderKind, string> = {
  openai: "OpenAI-compatible",
  openrouter: "OpenRouter",
  ollama: "Ollama",
}

function toDraft(provider: PublicProvider): Draft {
  return { ...provider, apiKeyInput: "", clearKey: false }
}

export function SettingsForm() {
  const [drafts, setDrafts] = React.useState<Draft[]>([])
  const [defaultProviderId, setDefaultProviderId] = React.useState("")
  const [meta, setMeta] = React.useState<{
    locked: boolean
    settingsPath: string
    presets: Preset[]
  } | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [probes, setProbes] = React.useState<Record<string, ProbeState>>({})
  const [testing, setTesting] = React.useState<string | null>(null)

  const apply = React.useCallback((data: SettingsResponse) => {
    setDrafts(data.providers.map(toDraft))
    setDefaultProviderId(data.defaultProviderId)
    setMeta({
      locked: data.locked,
      settingsPath: data.settingsPath,
      presets: data.presets,
    })
  }, [])

  React.useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data: SettingsResponse) => apply(data))
      .catch(() => setError("Could not load the provider configuration"))
      .finally(() => setLoading(false))
  }, [apply])

  const locked = meta?.locked ?? false

  const update = (index: number, patch: Partial<Draft>) =>
    setDrafts((prev) =>
      prev.map((draft, i) => (i === index ? { ...draft, ...patch } : draft))
    )

  const addProvider = (preset: Preset) => {
    const base = preset.label || "New provider"
    let label = base
    let n = 2
    while (drafts.some((d) => d.label === label)) label = `${base} ${n++}`
    setDrafts((prev) => [
      ...prev,
      {
        id: "",
        label,
        kind: preset.kind,
        baseUrl: preset.baseUrl,
        model: "",
        hasApiKey: false,
        apiKeyHint: null,
        apiKeyFromEnv: false,
        apiKeyInput: "",
        clearKey: false,
      },
    ])
  }

  const removeProvider = (index: number) =>
    setDrafts((prev) => prev.filter((_, i) => i !== index))

  const test = async (index: number) => {
    const draft = drafts[index]
    const key = draft.id || draft.label
    setTesting(key)
    try {
      const res = await fetch("/api/settings/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: draft.id || undefined,
          kind: draft.kind,
          baseUrl: draft.baseUrl,
          apiKey: draft.apiKeyInput || undefined,
          model: draft.model,
        }),
      })
      const data = (await res.json()) as ProbeState & { error?: string }
      setProbes((prev) => ({
        ...prev,
        [key]: {
          ok: Boolean(data.ok),
          message: data.error ?? data.message,
          models: data.models ?? [],
        },
      }))
    } catch (err) {
      setProbes((prev) => ({
        ...prev,
        [key]: {
          ok: false,
          message: err instanceof Error ? err.message : String(err),
          models: [],
        },
      }))
    } finally {
      setTesting(null)
    }
  }

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providers: drafts.map((draft) => ({
            id: draft.id || undefined,
            label: draft.label,
            kind: draft.kind,
            baseUrl: draft.baseUrl,
            model: draft.model,
            // undefined keeps the stored key, "" deletes it.
            apiKey: draft.clearKey ? "" : draft.apiKeyInput || undefined,
          })),
          defaultProviderId,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `Save failed (${res.status})`)
      apply(data as SettingsResponse)
      toast.success("Provider configuration saved")
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner /> Loading configuration…
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {locked && (
        <p className="inline-flex items-center gap-2 rounded-lg border border-(--rox-gold)/40 bg-(--rox-gold)/5 p-3 text-xs leading-relaxed">
          <LockIcon className="size-4 shrink-0 text-(--rox-gold)" />
          Settings are locked on this deployment
          (<code className="font-mono">RODEOS_SETTINGS_LOCKED=true</code>) — the
          providers come from the .env file and cannot be changed here.
        </p>
      )}

      {drafts.map((draft, index) => {
        const key = draft.id || draft.label
        const probe = probes[key]
        const isDefault = draft.id !== "" && draft.id === defaultProviderId
        return (
          <Card key={`${key}-${index}`}>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2 text-(--rox-blue-deep) dark:text-(--rox-blue-soft)">
                {draft.label || "New provider"}
                {draft.builtin && (
                  <Badge variant="outline" className="rounded text-[10px] font-normal">
                    from .env
                  </Badge>
                )}
                {isDefault && (
                  <Badge className="rounded bg-(--rox-teal) text-[10px] font-normal text-white">
                    default
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                {draft.kind === "openrouter"
                  ? "OpenAI-compatible, and the only provider that can extract text from PDFs."
                  : draft.kind === "ollama"
                    ? "Local inference — no API key required."
                    : "Any endpoint speaking the OpenAI protocol (IONOS, OpenAI, vLLM, …)."}
              </CardDescription>
              <CardAction>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => test(index)}
                    disabled={testing !== null}
                  >
                    {testing === key ? (
                      <Spinner data-icon="inline-start" />
                    ) : (
                      <PlugZapIcon data-icon="inline-start" />
                    )}
                    Test connection
                  </Button>
                  {!draft.builtin && !locked && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => removeProvider(index)}
                      title="Remove provider"
                      aria-label={`Remove ${draft.label}`}
                    >
                      <TrashIcon />
                    </Button>
                  )}
                </div>
              </CardAction>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`label-${index}`}>Name</Label>
                  <Input
                    id={`label-${index}`}
                    value={draft.label}
                    disabled={locked}
                    onChange={(e) => update(index, { label: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`kind-${index}`}>Protocol</Label>
                  <Select
                    value={draft.kind}
                    onValueChange={(v) =>
                      v && update(index, { kind: v as ProviderKind })
                    }
                    disabled={locked}
                  >
                    <SelectTrigger id={`kind-${index}`} className="w-full">
                      <SelectValue>
                        {(kind: ProviderKind | null) =>
                          kind ? KIND_LABELS[kind] : ""
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(KIND_LABELS) as ProviderKind[]).map((kind) => (
                        <SelectItem key={kind} value={kind}>
                          {KIND_LABELS[kind]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <Label htmlFor={`url-${index}`}>Endpoint URL</Label>
                  <Input
                    id={`url-${index}`}
                    value={draft.baseUrl}
                    disabled={locked}
                    placeholder="https://openai.inference.de-txl.ionos.com/v1"
                    className="font-mono text-xs"
                    onChange={(e) => update(index, { baseUrl: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <Label htmlFor={`key-${index}`}>API key</Label>
                  <div className="flex items-center gap-1">
                    <Input
                      id={`key-${index}`}
                      type="password"
                      value={draft.apiKeyInput}
                      disabled={locked || draft.kind === "ollama"}
                      placeholder={
                        draft.kind === "ollama"
                          ? "not required"
                          : draft.clearKey
                            ? "will be removed on save"
                            : draft.hasApiKey
                              ? `stored ${draft.apiKeyHint} — type to replace`
                              : "paste your key"
                      }
                      className="font-mono text-xs"
                      onChange={(e) =>
                        update(index, {
                          apiKeyInput: e.target.value,
                          clearKey: false,
                        })
                      }
                    />
                    {draft.hasApiKey &&
                      !draft.apiKeyFromEnv &&
                      !locked &&
                      draft.kind !== "ollama" && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="Remove the stored key"
                          aria-label="Remove the stored key"
                          onClick={() =>
                            update(index, { clearKey: true, apiKeyInput: "" })
                          }
                        >
                          <TrashIcon />
                        </Button>
                      )}
                  </div>
                  {draft.apiKeyFromEnv && (
                    <p className="text-xs text-muted-foreground">
                      Taken from the .env file — type a key here to override it,
                      or change it in .env.
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <Label htmlFor={`model-${index}`}>Default model</Label>
                  <Input
                    id={`model-${index}`}
                    value={draft.model}
                    disabled={locked}
                    placeholder="e.g. openai/gpt-4o-mini"
                    className="font-mono text-xs"
                    onChange={(e) => update(index, { model: e.target.value })}
                  />
                </div>
              </div>

              {probe && (
                <div
                  className={
                    probe.ok
                      ? "rounded-lg border border-(--rox-teal)/40 bg-(--rox-teal)/5 p-3 text-xs leading-relaxed"
                      : "rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs leading-relaxed text-destructive"
                  }
                >
                  <p
                    className={
                      probe.ok
                        ? "inline-flex items-center gap-1 font-medium text-(--rox-teal)"
                        : "inline-flex items-center gap-1 font-medium"
                    }
                  >
                    {probe.ok ? (
                      <CheckIcon className="size-3.5" />
                    ) : (
                      <TriangleAlertIcon className="size-3.5" />
                    )}
                    {probe.message}
                  </p>
                  {probe.models.length > 0 && (
                    <div className="mt-2 flex max-h-32 flex-wrap gap-1 overflow-auto">
                      {probe.models.map((id) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => update(index, { model: id })}
                          title="Use this model"
                          className="rounded border px-1.5 py-0.5 font-mono text-[10px] transition-colors hover:border-(--rox-blue) hover:text-(--rox-blue)"
                        >
                          {id}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}

      {!locked && meta && (
        <Card>
          <CardHeader>
            <CardTitle className="text-(--rox-blue-deep) dark:text-(--rox-blue-soft)">
              Add a provider
            </CardTitle>
            <CardDescription>
              Any endpoint that speaks the OpenAI protocol works — pick a
              preset to prefill its URL.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {meta.presets.map((preset) => (
              <Button
                key={preset.label}
                variant="outline"
                size="sm"
                title={preset.hint}
                onClick={() => addProvider(preset)}
              >
                <PlusIcon data-icon="inline-start" />
                {preset.label}
              </Button>
            ))}
          </CardContent>
        </Card>
      )}

      <Separator />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="default-provider">Default provider</Label>
          <Select
            value={defaultProviderId || null}
            onValueChange={(v) => v && setDefaultProviderId(v)}
            disabled={locked}
          >
            <SelectTrigger id="default-provider" className="w-64">
              <SelectValue placeholder="Select…">
                {(id: string | null) =>
                  drafts.find((d) => d.id === id)?.label ?? "Select…"
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {drafts
                .filter((draft) => draft.id)
                .map((draft) => (
                  <SelectItem key={draft.id} value={draft.id}>
                    {draft.label}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Newly added providers can be made the default after saving.
          </p>
        </div>

        {!locked && (
          <Button
            size="lg"
            className="bg-(--rox-blue-deep) text-white hover:bg-(--rox-blue) dark:bg-(--rox-blue-soft) dark:text-(--rox-blue-deep) dark:hover:bg-(--rox-blue-100)"
            onClick={save}
            disabled={saving}
          >
            {saving ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <SaveIcon data-icon="inline-start" />
            )}
            {saving ? "Saving…" : "Save configuration"}
          </Button>
        )}
      </div>

      {error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-2.5 text-xs leading-relaxed text-destructive">
          {error}
        </p>
      )}

      {meta && (
        <p className="text-xs text-muted-foreground">
          Stored server-side in{" "}
          <code className="font-mono">{meta.settingsPath}</code>. API keys stay
          on the server — the browser only ever sees the last four characters.
        </p>
      )}
    </div>
  )
}
