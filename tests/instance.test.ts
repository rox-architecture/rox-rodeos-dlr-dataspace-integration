import { describe, expect, it } from "vitest"
import {
  inferSelections,
  instanceToFormState,
  validateInstance,
} from "@/lib/instance"
import { SEMANTIC_AXIS } from "@/lib/semantic-model"

/** Minimal complete software instance on the v1.1 model. */
const software: Record<string, unknown> = {
  "dcterms:title": "Test pose estimator",
  "dcterms:type": "softwareComponent",
  "dcterms:publisher": "Test GmbH",
  "dcterms:license": "https://www.apache.org/licenses/LICENSE-2.0",
  "dcterms:identifier": "test-pose-estimator",
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
  "rodeos:trl": 6,
  "rodeos:runtimeOutputs": ["6D pose per instance"],
  "rodeos:operationalType": "container",
  "rodeos:distributionType": "oci_registry",
  "rodeos:imageName": "test/pose",
  "rodeos:imageTag": "1.0.0",
  "rodeos:platforms": ["linux/amd64"],
  "rodeos:hardwareRequirements": [
    { subject: "hardware.compute.gpu", operator: "required" },
  ],
}

describe("validateInstance", () => {
  it("accepts a complete software instance", () => {
    const result = validateInstance(software)
    expect(result.ok).toBe(true)
    expect(result.missing).toEqual([])
    expect(result.invalid).toEqual({})
    expect(result.unknown).toEqual([])
    expect(result.path).toEqual([
      "rodeos:Component",
      "rodeos:softwareComponent",
      "rodeos:perceptionVisionSoftware",
    ])
    expect(result.operationalPath).toEqual(["rodeos:container"])
    expect(result.normalized["rodeos:trl"]).toBe(6)
  })

  it("reports missing mandatory fields", () => {
    const withoutLicense = Object.fromEntries(
      Object.entries(software).filter(([k]) => k !== "dcterms:license")
    )
    const result = validateInstance(withoutLicense)
    expect(result.ok).toBe(false)
    expect(result.missing).toEqual(["dcterms:license"])
  })

  it("reports invalid values", () => {
    const result = validateInstance({
      ...software,
      "rodeos:perceptionVisionSoftwareType": "teleportation",
      "rodeos:trl": "six",
    })
    expect(result.ok).toBe(false)
    expect(Object.keys(result.invalid).sort()).toEqual([
      "rodeos:perceptionVisionSoftwareType",
      "rodeos:trl",
    ])
  })

  it("lists keys the model does not know without failing", () => {
    const result = validateInstance({ ...software, "rodeos:colour": "blue" })
    expect(result.ok).toBe(true)
    expect(result.unknown).toEqual(["rodeos:colour"])
  })

  it("flags an unfinished hierarchy", () => {
    const result = validateInstance({
      ...software,
      "rodeos:componentType": "hardwareComponent",
    })
    expect(result.ok).toBe(false)
    expect(result.missing).toContain("sub-type below rodeos:hardwareComponent")
  })
})

describe("inferSelections", () => {
  it("finds the hardware branch from field names", () => {
    const gripper = {
      "rodeos:coreType": "Component",
      "rodeos:componentType": "hardwareComponent",
      "rodeos:gripperType": "Vacuum",
      "rodeos:supplyVoltage": 24,
    }
    expect(inferSelections(gripper, SEMANTIC_AXIS)).toEqual({
      "rodeos:Component/rodeos:hardwareComponent": "rodeos:tooling",
      "rodeos:Component/rodeos:hardwareComponent/rodeos:tooling": "rodeos:gripperTool",
    })
  })

  it("needs no selections for software", () => {
    expect(inferSelections(software, SEMANTIC_AXIS)).toEqual({})
  })
})

describe("instanceToFormState", () => {
  it("turns an instance into UI values", () => {
    const state = instanceToFormState({ ...software, "rodeos:colour": "blue" })
    expect(state.values["rodeos:softwareAssetType"]).toBe("perceptionVisionSoftware")
    // Lists become the comma-separated text the inputs edit …
    expect(state.values["dcat:keyword"]).toBe("pose estimation, test")
    // … except enum lists and requirement rows, which stay arrays.
    expect(state.values["rodeos:platforms"]).toEqual(["linux/amd64"])
    expect(state.values["rodeos:hardwareRequirements"]).toEqual([
      { subject: "hardware.compute.gpu", operator: "required" },
    ])
    expect(state.values["rodeos:trl"]).toBe("6")
    expect(state.skipped).toEqual(["rodeos:colour"])
    expect(state.applied).toContain("dcterms:title")
    expect(state.path.at(-1)).toBe("rodeos:perceptionVisionSoftware")
  })
})
