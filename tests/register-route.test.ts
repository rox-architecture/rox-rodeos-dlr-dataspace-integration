import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { POST } from "@/app/api/dataspace/register/route"
import { complete } from "./fixtures/instance"

const post = (body: unknown) =>
  POST(
    new Request("http://localhost/api/dataspace/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  )

describe("POST /api/dataspace/register", () => {
  const saved: Record<string, string | undefined> = {}
  beforeEach(() => {
    for (const k of ["DATASPACE_API_KEY", "DATASPACE_CONNECTOR"]) {
      saved[k] = process.env[k]
      delete process.env[k]
    }
  })
  afterEach(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
  })

  it("refuses an incomplete instance with 422 and names the fields", async () => {
    const res = await post({ instance: { "dcterms:title": "x" } })
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.missing).toContain("dcterms:license")
    expect(body.missing).toContain("rodeos:coreType")
    expect(body.error).toMatch(/not complete/)
  })

  it("refuses invalid values with 422", async () => {
    const res = await post({
      instance: { ...complete, "rodeos:perceptionVisionSoftwareType": "teleportation" },
    })
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(Object.keys(body.invalid)).toEqual(["rodeos:perceptionVisionSoftwareType"])
  })

  it("answers a dry run without touching the dataspace, even when unconfigured", async () => {
    const res = await post({ instance: complete, dryRun: true })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.dryRun).toBe(true)
    expect(body.filename).toBe("test-pose-estimator.json")
    expect(body.path).toEqual([
      "rodeos:Component",
      "rodeos:softwareComponent",
      "rodeos:perceptionVisionSoftware",
    ])
    expect(body.operationalPath).toEqual(["rodeos:container"])
    expect(body.unknown).toEqual([])
    expect(body.kitMetadata).toMatch(/^container/)
  })

  it("reports keys the model does not declare as unknown in a dry run", async () => {
    const res = await post({ instance: { ...complete, "x:extra": 1 }, dryRun: true })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.unknown).toEqual(["x:extra"])
  })

  it("honours explicit selections in a dry run", async () => {
    const hardware = {
      ...complete,
      "rodeos:componentType": "hardwareComponent",
      "rodeos:manufacturer": "ACME",
      "rodeos:aasSubmodel": "https://example.org/aas.json",
      "rodeos:resolution": "1280x720",
      "rodeos:operationalType": "static_file",
      "rodeos:fileFormat": "json",
    }
    // Strip the software-only fields so the instance is complete on the sensor path.
    for (const k of [
      "rodeos:softwareAssetType",
      "rodeos:capabilityClass",
      "rodeos:perceptionVisionSoftwareType",
      "rodeos:distributionType",
      "rodeos:imageName",
      "rodeos:imageTag",
      "rodeos:platforms",
    ]) {
      delete (hardware as Record<string, unknown>)[k]
    }
    const res = await post({
      instance: hardware,
      dryRun: true,
      selections: {
        "rodeos:Component/rodeos:hardwareComponent": "rodeos:sensor",
        "rodeos:Component/rodeos:hardwareComponent/rodeos:sensor": "rodeos:visionSensor",
      },
    })
    const body = await res.json()
    expect(res.status, JSON.stringify(body)).toBe(200)
    expect(body.path.at(-1)).toBe("rodeos:visionSensor")
  })

  it("only treats the boolean true as a dry run", async () => {
    // A string "false" must not be read as truthy — this call is a real
    // registration attempt and therefore hits the missing configuration.
    const res = await post({ instance: complete, dryRun: "false" })
    expect(res.status).toBe(503)
  })

  it("refuses a policy override that gives only one of the two ids", async () => {
    const res = await post({ instance: complete, policies: { accessPolicyId: "A" } })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/both accessPolicyId and contractPolicyId/)
  })

  it("reports the missing connection only after validation passed", async () => {
    const res = await post({ instance: complete })
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error).toMatch(/API key/)
  })

  it("refuses a valid instance that brings no API key, however complete the environment", async () => {
    process.env.DATASPACE_API_KEY = "env-key"
    process.env.DATASPACE_CONNECTOR = "env-connector"
    try {
      const res = await post({
        instance: complete,
        dataspace: { connector: "env-connector" },
      })
      expect(res.status).toBe(503)
    } finally {
      delete process.env.DATASPACE_API_KEY
      delete process.env.DATASPACE_CONNECTOR
    }
  })

  it("still rejects a missing instance with 400", async () => {
    const res = await post({})
    expect(res.status).toBe(400)
  })
})
