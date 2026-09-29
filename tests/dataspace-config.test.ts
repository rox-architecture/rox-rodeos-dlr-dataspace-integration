import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { resolveDataspaceConfig } from "@/lib/dataspace"

const ENV_KEYS = [
  "DATASPACE_API_KEY",
  "DATASPACE_CONNECTOR",
  "DATASPACE_API_URL",
] as const

describe("resolveDataspaceConfig", () => {
  const saved: Record<string, string | undefined> = {}

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      saved[key] = process.env[key]
      delete process.env[key]
    }
  })

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key]
      else process.env[key] = saved[key]
    }
  })

  it("takes connector and URL from the environment as defaults", () => {
    process.env.DATASPACE_CONNECTOR = "env-connector"
    process.env.DATASPACE_API_URL = "https://env.example.org"
    expect(resolveDataspaceConfig({ apiKey: "own-key" })).toMatchObject({
      apiKey: "own-key",
      connector: "env-connector",
      apiUrl: "https://env.example.org",
    })
  })

  it("never takes the API key from the environment", () => {
    process.env.DATASPACE_API_KEY = "env-key"
    process.env.DATASPACE_CONNECTOR = "env-connector"
    // A caller without a key gets nothing, however complete the environment is.
    expect(resolveDataspaceConfig()).toBeNull()
    expect(resolveDataspaceConfig({ connector: "own-connector" })).toBeNull()
    expect(resolveDataspaceConfig({ apiKey: "own-key" })?.apiKey).toBe("own-key")
  })

  it("treats an empty or blank field as 'not given'", () => {
    process.env.DATASPACE_API_KEY = "env-key"
    process.env.DATASPACE_CONNECTOR = "env-connector"
    expect(resolveDataspaceConfig({ apiKey: "   " })).toBeNull()
    expect(
      resolveDataspaceConfig({ apiKey: "own-key", connector: "   " })
    ).toMatchObject({ apiKey: "own-key", connector: "env-connector" })
  })

  it("works with no environment at all, from the caller alone", () => {
    expect(
      resolveDataspaceConfig({ apiKey: "own-key", connector: "own-connector" })
    ).toMatchObject({
      apiKey: "own-key",
      connector: "own-connector",
      apiUrl: "https://vision-x-api.base-x-ecosystem.org",
    })
  })

  it("is null while key or connector is missing", () => {
    expect(resolveDataspaceConfig()).toBeNull()
    expect(resolveDataspaceConfig({ apiKey: "own-key" })).toBeNull()
    expect(resolveDataspaceConfig({ connector: "own-connector" })).toBeNull()
  })

  it("strips a trailing slash so paths never double up", () => {
    const config = resolveDataspaceConfig({
      apiKey: "k",
      connector: "c",
      apiUrl: "https://example.org/",
    })
    expect(config?.apiUrl).toBe("https://example.org")
  })
})
