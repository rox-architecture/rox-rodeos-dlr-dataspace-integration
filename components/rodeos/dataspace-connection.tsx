"use client"

import * as React from "react"
import {
  CheckIcon,
  PencilIcon,
  PlugZapIcon,
  TriangleAlertIcon,
} from "lucide-react"

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

export interface DataspaceConnection {
  apiUrl: string
  apiKey: string
  connector: string
}

interface ServerDefaults {
  apiUrl: string
  connector: string
}

interface ContextValue {
  /** Sent with a register call; an empty field falls back to the server environment. */
  connection: DataspaceConnection
  /** False while a mandatory field is unanswered — the register button stays locked. */
  complete: boolean
  /** False until /api/config answered; avoids a red flash on first paint. */
  ready: boolean
  set: (field: keyof DataspaceConnection, value: string) => void
}

// Per browser session, as asked: a deployed instance serves many users, and the
// key should not outlive the tab it was typed into.
const STORAGE_KEY = "rodeos.dataspace"

const Context = React.createContext<ContextValue | null>(null)

export function useDataspaceConnection(): ContextValue {
  const value = React.useContext(Context)
  if (!value) {
    throw new Error(
      "useDataspaceConnection must be used inside <DataspaceConnectionProvider>"
    )
  }
  return value
}

export function DataspaceConnectionProvider({
  children,
}: {
  children: React.ReactNode
}) {
  // Only what this session typed. Everything else is derived from the server
  // defaults, so no effect ever has to copy one into the other.
  const [entered, setEntered] = React.useState<Partial<DataspaceConnection>>({})
  const [defaults, setDefaults] = React.useState<ServerDefaults | null>(null)

  React.useEffect(() => {
    let cancelled = false
    fetch("/api/config")
      .then((r) => r.json())
      .catch(() => ({}))
      .then((cfg) => {
        if (cancelled) return
        let stored: Partial<DataspaceConnection> = {}
        try {
          const raw = window.sessionStorage.getItem(STORAGE_KEY)
          if (raw) stored = JSON.parse(raw) as Partial<DataspaceConnection>
        } catch {
          // Private window, blocked storage or a stale value — start empty.
        }
        setEntered(stored)
        setDefaults({
          apiUrl: cfg.dataspace?.apiUrl ?? "",
          connector: cfg.dataspace?.connector ?? "",
        })
      })
    return () => {
      cancelled = true
    }
  }, [])

  React.useEffect(() => {
    // Before the defaults land `entered` is still the empty placeholder, and
    // writing that would erase what the session had remembered.
    if (!defaults) return
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entered))
    } catch {
      // Not being able to remember is not worth interrupting the user over.
    }
  }, [entered, defaults])

  const set = React.useCallback(
    (field: keyof DataspaceConnection, value: string) =>
      setEntered((prev) => ({ ...prev, [field]: value })),
    []
  )

  const value = React.useMemo(() => {
    // An entry wins over the server default. The key has no default at all:
    // it is always stated per session, so the same flow can be tested locally
    // that a deployed instance will use.
    const connection: DataspaceConnection = {
      apiUrl: entered.apiUrl ?? defaults?.apiUrl ?? "",
      apiKey: entered.apiKey ?? "",
      connector: entered.connector ?? defaults?.connector ?? "",
    }
    const complete =
      connection.apiUrl.trim() !== "" &&
      connection.connector.trim() !== "" &&
      connection.apiKey.trim() !== ""
    return { connection, complete, ready: defaults !== null, set }
  }, [entered, defaults, set])

  return <Context.Provider value={value}>{children}</Context.Provider>
}

/**
 * Where the instance gets registered. Deliberately the first thing in the right
 * column and styled apart from the form cards: it is not part of the asset
 * description, but it decides whether registering works at all.
 */
export function DataspaceConnectionCard() {
  const { connection, complete, ready, set } = useDataspaceConnection()
  // Open by default: these three decide where the asset ends up, so they are
  // shown rather than hidden behind a disclosure. Collapsing is allowed only
  // once they are actually answered.
  const [collapsed, setCollapsed] = React.useState(false)
  const expanded = !collapsed || !complete

  // Nothing is wrong yet while the defaults are still loading.
  const missing = (value: string) => ready && value.trim() === ""

  return (
    <Card
      className={
        ready && !complete
          ? "border-destructive/60 bg-destructive/5 ring-1 ring-destructive/25"
          : "border-(--rox-teal)/40 bg-(--rox-teal)/5"
      }
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5 text-(--rox-blue-deep) dark:text-(--rox-blue-soft)">
          <PlugZapIcon className="size-4" />
          Data Space connection
        </CardTitle>
        <CardDescription>
          {!ready ? (
            <span className="text-muted-foreground">Loading defaults…</span>
          ) : complete ? (
            <span className="inline-flex items-center gap-1 text-(--rox-teal)">
              <CheckIcon className="size-3.5" />
              {connection.connector.trim()} ·{" "}
              {connection.apiUrl.replace(/^https?:\/\//, "")} ·{" "}
              session key
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 font-medium text-destructive">
              <TriangleAlertIcon className="size-3.5" />
              {connection.apiKey.trim() === ""
                ? "API key required — enter your own to register"
                : "Required before an asset can be registered"}
            </span>
          )}
        </CardDescription>
        {ready && complete && (
          <CardAction>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCollapsed((v) => !v)}
              title="Show or hide the connection fields"
            >
              <PencilIcon data-icon="inline-start" />
              {collapsed ? "Show" : "Hide"}
            </Button>
          </CardAction>
        )}
      </CardHeader>

      {expanded && (
        <CardContent className="flex flex-col gap-3">
          <Field
            id="dataspace-api-url"
            label="API URL"
            hint="Endpoint of the dataspace API"
            value={connection.apiUrl}
            invalid={missing(connection.apiUrl)}
            onChange={(v) => set("apiUrl", v)}
            placeholder="https://vision-x-api.base-x-ecosystem.org"
          />
          <Field
            id="dataspace-api-key"
            label="API key"
            hint="Your personal bearer token — never taken from the server"
            value={connection.apiKey}
            invalid={missing(connection.apiKey)}
            onChange={(v) => set("apiKey", v)}
            placeholder="Paste your key"
            type="password"
            autoComplete="off"
          />
          <Field
            id="dataspace-connector"
            label="Connector"
            hint="Name of your connector as the dashboard shows it"
            value={connection.connector}
            invalid={missing(connection.connector)}
            onChange={(v) => set("connector", v)}
            placeholder="my-connector"
          />
          <p className="text-xs leading-relaxed text-muted-foreground">
            Kept for this browser session only — never written to the server.
            URL and connector fall back to the server environment when left
            empty; the key never does.
          </p>
        </CardContent>
      )}
    </Card>
  )
}

function Field({
  id,
  label,
  hint,
  value,
  invalid,
  onChange,
  placeholder,
  type,
  autoComplete,
}: {
  id: string
  label: string
  hint: string
  value: string
  invalid: boolean
  onChange: (value: string) => void
  placeholder?: string
  type?: string
  autoComplete?: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id} className="text-xs">
        {label}
        <span className="text-destructive" aria-hidden>
          *
        </span>
      </Label>
      <Input
        id={id}
        type={type}
        autoComplete={autoComplete}
        value={value}
        placeholder={placeholder}
        aria-invalid={invalid}
        onChange={(e) => onChange(e.target.value)}
        className="font-mono text-xs"
      />
      <p
        className={
          invalid
            ? "text-xs text-destructive/80"
            : "text-xs text-muted-foreground"
        }
      >
        {invalid ? "Required — still empty" : hint}
      </p>
    </div>
  )
}
