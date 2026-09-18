import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { POST } from "@/app/api/dataspace/register/route"

const complete: Record<string, unknown> = {
  "dcterms:title": "Test pose estimator",
  "dcterms:type": "softwareComponent",
  "dcterms:publisher": "Test GmbH",
  "dcterms:license": "https://www.apache.org/licenses/LICENSE-2.0",
  "dcterms:identifier": "Test Pose Estimator",
  "dcterms:description": "Estimates poses.",
  "dcat:version": "1.0.0",
  "dcat:keyword": ["pose estimation", "test"],
  "dcat:contactPoint": "someone@example.org",
  "rodeos:coreType": "Component",
  "rodeos:componentType": "softwareComponent",
  "rodeos:softwareAssetType": "perceptionVisionSoftware",
  "rodeos:capabilityClass": "perception",
  "rodeos:perceptionVisionSoftwareType": "poseEstimation",
  "rodeos:aasSubmodel": "https://example.org/aas.json",
  "rodeos:operationalType": "container",
  "rodeos:distributionType": "oci_registry",
  "rodeos:imageName": "test/pose",
  "rodeos:imageTag": "1.0.0",
  "rodeos:platforms": ["linux/amd64"],
  "rodeos:hardwareRequirements": [
    { subject: "hardware.compute.gpu", operator: "required" },
  ],
}

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

  it("reports missing configuration only after validation passed", async () => {
    const res = await post({ instance: complete })
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error).toMatch(/not configured/)
  })

  it("still rejects a missing instance with 400", async () => {
    const res = await post({})
    expect(res.status).toBe(400)
  })
})
