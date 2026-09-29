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

/** The two auto-selected levels every hardware instance carries. */
const hardwareBase: Record<string, unknown> = {
  "rodeos:coreType": "Component",
  "rodeos:componentType": "hardwareComponent",
}

/** Hardware instance whose field names single out tooling → gripperTool. */
const gripper: Record<string, unknown> = {
  ...hardwareBase,
  "rodeos:gripperType": "Vacuum",
  "rodeos:supplyVoltage": 24,
}

/** Hardware instance that says nothing a sub-type could be inferred from. */
const tiedHardware: Record<string, unknown> = {
  ...hardwareBase,
  "rodeos:manufacturer": "X",
  "rodeos:aasSubmodel": "https://example.org/a.json",
}

const SENSOR_SELECTIONS = {
  "rodeos:Component/rodeos:hardwareComponent": "rodeos:sensor",
  "rodeos:Component/rodeos:hardwareComponent/rodeos:sensor": "rodeos:visionSensor",
}

/** Minimal complete Dataset instance — without rodeos:isDataproduct on purpose. */
const dataset: Record<string, unknown> = {
  "dcterms:title": "Test dataset",
  "dcterms:type": "Dataset",
  "dcterms:publisher": "Test GmbH",
  "dcterms:license": "https://creativecommons.org/licenses/by/4.0/",
  "dcterms:identifier": "test-dataset",
  "dcterms:description": "Rows of test data.",
  "dcat:version": "1.0.0",
  "dcat:keyword": ["test"],
  "dcat:contactPoint": "someone@example.org",
  "rodeos:coreType": "Dataset",
  "dprod:informationSensitivityClassification": "public",
  "dprod:type": "source-aligned",
  "rodeos:dataFormat": "csv",
  "dcat:byteSize": 1024,
  "rodeos:operationalType": "static_file",
  "rodeos:fileFormat": "csv",
}

/** Read straight from the model so the test does not hard-code the URL. */
const GRIPPER_AAS_DEFAULT = SEMANTIC_AXIS.root.instances!["rodeos:Component"]
  .instances!["rodeos:hardwareComponent"].instances!["rodeos:tooling"]
  .instances!["rodeos:gripperTool"].defaultValues!["rodeos:aasSubmodel"]

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

  it("rejects a list where the semantic auto-selector expects one value", () => {
    const result = validateInstance({ ...software, "rodeos:coreType": ["Component"] })
    expect(result.ok).toBe(false)
    expect(result.invalid).toHaveProperty("rodeos:coreType")
    expect(result.path).toEqual([])
  })

  it("rejects a list where the operational auto-selector expects one value", () => {
    const result = validateInstance({
      ...software,
      "rodeos:operationalType": ["container"],
    })
    expect(result.ok).toBe(false)
    expect(result.invalid).toHaveProperty("rodeos:operationalType")
    expect(result.operationalPath).toEqual([])
  })

  it("stops at a tie and asks for the sub-type", () => {
    const tied = { ...hardwareBase, "rodeos:aasSubmodel": "https://example.org/a.json" }
    expect(inferSelections(tied, SEMANTIC_AXIS)).toEqual({})
    expect(validateInstance(tied).missing).toContain(
      "sub-type below rodeos:hardwareComponent"
    )
  })

  it("reports a missing operational mandatory", () => {
    const withoutImage = Object.fromEntries(
      Object.entries(software).filter(([k]) => k !== "rodeos:imageName")
    )
    expect(validateInstance(withoutImage).missing).toContain("rodeos:imageName")
  })

  it("reports a bogus auto-selector once, not twice", () => {
    const result = validateInstance({ ...software, "rodeos:softwareAssetType": "nope" })
    expect(result.ok).toBe(false)
    expect(result.invalid).toHaveProperty("rodeos:softwareAssetType")
    expect(result.path.at(-1)).toBe("rodeos:softwareComponent")
    expect(result.missing).not.toContain("sub-type below rodeos:softwareComponent")
  })

  it("accepts an absent mandatory boolean as false", () => {
    const result = validateInstance(dataset)
    expect(result.ok).toBe(true)
    expect(result.missing).toEqual([])
    expect(result.normalized["rodeos:isDataproduct"]).toBe(false)
  })

  it("follows explicit selections where the instance ties", () => {
    const result = validateInstance(tiedHardware, { selections: SENSOR_SELECTIONS })
    expect(result.path.at(-1)).toBe("rodeos:visionSensor")
  })
})

describe("inferSelections", () => {
  it("finds the hardware branch from field names", () => {
    expect(inferSelections(gripper, SEMANTIC_AXIS)).toEqual({
      "rodeos:Component/rodeos:hardwareComponent": "rodeos:tooling",
      "rodeos:Component/rodeos:hardwareComponent/rodeos:tooling": "rodeos:gripperTool",
    })
  })

  it("needs no selections for software", () => {
    expect(inferSelections(software, SEMANTIC_AXIS)).toEqual({})
  })

  it("ignores fields the walked path already declares", () => {
    // rodeos:manufacturer is optional on hardwareComponent and mandatory on
    // tooling — it must not make tooling the winner.
    expect(inferSelections(tiedHardware, SEMANTIC_AXIS)).toEqual({})
    expect(
      inferSelections({ ...tiedHardware, "rodeos:resolution": "1280x720" }, SEMANTIC_AXIS)
    ).toEqual(SENSOR_SELECTIONS)
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

  it("recovers selections and model defaults for hardware", () => {
    const state = instanceToFormState(gripper)
    expect(state.selections).toEqual({
      "rodeos:Component/rodeos:hardwareComponent": "rodeos:tooling",
      "rodeos:Component/rodeos:hardwareComponent/rodeos:tooling": "rodeos:gripperTool",
    })
    expect(state.values["rodeos:aasSubmodel"]).toBe(GRIPPER_AAS_DEFAULT)
  })
})
