"use client"

import * as React from "react"
import { CheckIcon, FileTextIcon, FileUpIcon, XIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"

type Status = "idle" | "reading" | "extracting" | "done" | "error"

interface UploadedFile {
  name: string
  size: number
}

export interface DocDropzoneProps {
  /** Id of the selected LLM provider. */
  provider: string
  model: string
  /** Called with the extracted document text once available. */
  onText: (text: string, filename: string) => void
  onClear: () => void
}

const ACCEPT = ".pdf,.md,.markdown,.txt"
const MAX_SIZE = 20 * 1024 * 1024

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export function DocDropzone({ provider, model, onText, onClear }: DocDropzoneProps) {
  const [file, setFile] = React.useState<UploadedFile | null>(null)
  const [status, setStatus] = React.useState<Status>("idle")
  const [dragOver, setDragOver] = React.useState(false)
  const [chars, setChars] = React.useState(0)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const requestId = React.useRef(0)

  const reset = () => {
    requestId.current++
    setFile(null)
    setStatus("idle")
    setChars(0)
    if (inputRef.current) inputRef.current.value = ""
    onClear()
  }

  const finish = (id: number, text: string, name: string) => {
    if (id !== requestId.current) return
    setChars(text.length)
    setStatus("done")
    onText(text, name)
  }

  const fail = (id: number, message: string) => {
    if (id !== requestId.current) return
    setStatus("error")
    toast.error(message)
  }

  const handleFile = (f: File | undefined) => {
    if (!f) return
    const ext = f.name.split(".").pop()?.toLowerCase() ?? ""
    const isPdf = ext === "pdf" || f.type === "application/pdf"
    const isText = ["md", "markdown", "txt"].includes(ext) || f.type.startsWith("text/")

    if (!isPdf && !isText) {
      toast.error("Please upload a PDF, Markdown or TXT file.")
      return
    }
    if (f.size > MAX_SIZE) {
      toast.error("File too large — please keep it below 20 MB.")
      return
    }

    const id = ++requestId.current
    setFile({ name: f.name, size: f.size })

    if (isText && !isPdf) {
      setStatus("reading")
      f.text()
        .then((text) => finish(id, text, f.name))
        .catch(() => fail(id, "Could not read the file."))
      return
    }

    // PDF → base64 → LLM extraction on the server
    setStatus("extracting")
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        const dataUrl = String(reader.result)
        const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1)
        const res = await fetch("/api/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: f.name, data: base64, provider, model }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? `Extraction failed (${res.status})`)
        finish(id, data.text, f.name)
      } catch (err) {
        fail(id, err instanceof Error ? err.message : String(err))
      }
    }
    reader.onerror = () => fail(id, "Could not read the file.")
    reader.readAsDataURL(f)
  }

  const busy = status === "reading" || status === "extracting"

  return (
    <div className="flex flex-col gap-2">
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          handleFile(e.dataTransfer.files?.[0])
        }}
        className={cn(
          "flex cursor-pointer justify-center rounded-lg border border-dashed border-input px-4 py-6 transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          dragOver ? "border-ring bg-accent/50" : "hover:bg-muted/50"
        )}
      >
        <div className="flex flex-col items-center gap-1 text-center">
          <FileUpIcon className="size-7 text-muted-foreground" aria-hidden />
          <p className="text-sm text-muted-foreground">
            Drag and drop or{" "}
            <span className="font-medium text-primary hover:underline hover:underline-offset-4">
              choose file
            </span>{" "}
            to upload
          </p>
          <p className="text-xs text-muted-foreground/70">
            PDF (extracted via LLM) · Markdown · TXT — max. 20 MB
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>

      {file && (
        <div className="relative flex flex-col gap-3 rounded-lg bg-muted p-3">
          <Button
            variant="ghost"
            size="icon-xs"
            className="absolute top-1.5 right-1.5 text-muted-foreground hover:text-foreground"
            aria-label="Remove file"
            onClick={reset}
          >
            <XIcon />
          </Button>

          <div className="flex items-center gap-2.5 pr-7">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-background shadow-xs ring-1 ring-border ring-inset">
              <FileTextIcon className="size-4.5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium">{file.name}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatFileSize(file.size)}
              </p>
            </div>
          </div>

          {busy && (
            <div className="flex items-center gap-2.5">
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-background">
                <div className="h-full w-1/2 animate-pulse rounded-full bg-primary" />
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Spinner className="size-3" />
                {status === "extracting" ? "Extracting via LLM…" : "Reading…"}
              </span>
            </div>
          )}
          {status === "done" && (
            <p className="inline-flex items-center gap-1 text-xs text-(--rox-teal)">
              <CheckIcon className="size-3.5" />
              Content extracted · {chars.toLocaleString()} characters — review below
            </p>
          )}
          {status === "error" && (
            <p className="text-xs text-destructive">Extraction failed — try again or paste the text manually.</p>
          )}
        </div>
      )}
    </div>
  )
}
