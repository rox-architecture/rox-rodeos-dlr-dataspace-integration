"use client"

import * as React from "react"
import {
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  Globe2Icon,
  PackageIcon,
  SparklesIcon,
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
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { buildKitMetadata, describeKitMetadata } from "@/lib/kit-metadata"

const DATASPACE_DASHBOARD_URL =
  "https://vision-x-dataspace.base-x-ecosystem.org/#/dashboard"

interface RegisterResult {
  filename: string
  connector: string
  policySource: string
  kitMetadata: string
}

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
  const [dataspaceConfigured, setDataspaceConfigured] = React.useState<
    boolean | null
  >(null)
  const [registering, setRegistering] = React.useState(false)
  const [registerError, setRegisterError] = React.useState<string | null>(null)
  const [lastRegistration, setLastRegistration] = React.useState<
    (RegisterResult & { json: string }) | null
  >(null)

  const json = JSON.stringify(data, null, 2)
  const complete = missingMandatory.length === 0 && invalidCount === 0
  const hasContent = Object.keys(data).length > 0
  // What a KIT builder will read from the registered asset.
  const kit = React.useMemo(() => buildKitMetadata(data), [data])

  React.useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((cfg) => setDataspaceConfigured(Boolean(cfg.dataspaceConfigured)))
      .catch(() => setDataspaceConfigured(false))
  }, [])

  // The success state is only shown while the instance is unchanged since
  // registration — editing the form invalidates it.
  const registered =
    lastRegistration && lastRegistration.json === json ? lastRegistration : null

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

  const register = async () => {
    setRegistering(true)
    setRegisterError(null)
    try {
      const res = await fetch("/api/dataspace/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instance: data }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? `Registration failed (${res.status})`)
      setLastRegistration({ ...(body as RegisterResult), json })
      toast.success(`Asset "${body.filename}" registered in the dataspace`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setRegisterError(message)
      toast.error(message)
    } finally {
      setRegistering(false)
    }
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
          {kit && (
            <span className="inline-flex items-center gap-1">
              <PackageIcon className="size-3.5" />
              KIT metadata: {describeKitMetadata(kit)}
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
      <CardFooter className="flex flex-col gap-2">
        <Button
          className="w-full bg-(--rox-blue-deep) text-white hover:bg-(--rox-blue) dark:bg-(--rox-blue-soft) dark:text-(--rox-blue-deep) dark:hover:bg-(--rox-blue-100)"
          size="lg"
          onClick={download}
          disabled={!hasContent}
        >
          <DownloadIcon data-icon="inline-start" />
          Download semantic model (JSON)
        </Button>

        <Button
          className="w-full bg-(--rox-teal) text-white hover:bg-[#008f87] disabled:bg-(--rox-teal)/60"
          size="lg"
          onClick={register}
          disabled={
            !hasContent || !complete || registering || dataspaceConfigured === false
          }
          title={
            !complete
              ? "All mandatory fields must be valid before registering"
              : undefined
          }
        >
          {registering ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <Globe2Icon data-icon="inline-start" />
          )}
          {registering ? "Registering…" : "Register asset in Data Space"}
        </Button>

        {registerError && (
          <p className="w-full rounded-lg border border-destructive/30 bg-destructive/5 p-2.5 text-xs leading-relaxed text-destructive">
            {registerError}
          </p>
        )}

        {dataspaceConfigured === false && (
          <p className="text-xs text-muted-foreground">
            Dataspace access is not configured — set{" "}
            <code className="font-mono">DATASPACE_API_KEY</code> and{" "}
            <code className="font-mono">DATASPACE_CONNECTOR</code> in the .env
            file.
          </p>
        )}

        {registered && (
          <div className="w-full rounded-lg border border-(--rox-teal)/40 bg-(--rox-teal)/5 p-3 text-xs leading-relaxed">
            <p className="inline-flex items-center gap-1 font-medium text-(--rox-teal)">
              <CheckIcon className="size-3.5" />
              Registered as &quot;{registered.filename}&quot; via connector{" "}
              {registered.connector}
            </p>
            <p className="text-muted-foreground">
              KIT metadata: {registered.kitMetadata}
            </p>
            <p className="mt-1 text-muted-foreground">
              Policy: {registered.policySource === "env"
                ? "configured via .env"
                : registered.policySource === "existing"
                  ? "existing connector policy"
                  : "default policy created"}{" "}
              ·{" "}
              <a
                href={DATASPACE_DASHBOARD_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-(--rox-blue) underline-offset-4 hover:underline"
              >
                Open dataspace dashboard
              </a>
            </p>
          </div>
        )}
      </CardFooter>
    </Card>
  )
}
