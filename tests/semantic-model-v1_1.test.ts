import { describe, expect, it } from "vitest"
import {
  parseFieldType,
  semanticModel,
  type ModelNode,
} from "@/lib/semantic-model"

const root = semanticModel["dcat:Resource"]
const software =
  root.instances!["rodeos:Component"].instances!["rodeos:softwareComponent"]
const enumValues = (type: string) => parseFieldType(type).enumValues

const AI_DEPLOYMENT =
  "https://raw.githubusercontent.com/admin-shell-io/submodel-templates/refs/heads/main/published/Artificial%20Intelligence%20Deployment/1/0/IDTA%2002059-1-0_Template_AIDeployment.json"

describe("semantic model v1.1", () => {
  it("carries a model version", () => {
    expect(semanticModel["_version"]).toBe("1.1.0")
  })

  it("adds cross-cutting fields on dcat:Resource", () => {
    expect(root.optional).toMatchObject({
      "rodeos:trl": "xsd:integer",
      "rodeos:relevantUseCases": "List[xsd:text]",
      "rodeos:dependsOn": "List[xsd:text]",
      "rodeos:producesAsset": "List[xsd:text]",
    })
  })

  it("selects the software sub-type through a mandatory enum listing every instance", () => {
    const values = enumValues(software.mandatory!["rodeos:softwareAssetType"])
    const keys = Object.keys(software.instances!).map((k) =>
      k.replace(/^rodeos:/, "")
    )
    expect([...values].sort()).toEqual([...keys].sort())
    expect(software.optional).not.toHaveProperty("rodeos:softwareAssetType")
  })

  it("requires a capability class matching the TP3.X building-block classes", () => {
    expect(enumValues(software.mandatory!["rodeos:capabilityClass"])).toEqual([
      "hardwareAccess",
      "perception",
      "manipulation",
      "processExecution",
      "humanRobotInteraction",
      "foundationModel",
    ])
  })

  it("describes setup and runtime phases on every software component", () => {
    for (const name of [
      "rodeos:setupInputs",
      "rodeos:setupOutputs",
      "rodeos:runtimeInputs",
      "rodeos:runtimeOutputs",
    ]) {
      expect(software.optional![name]).toBe("List[xsd:text]")
    }
    expect(parseFieldType(software.optional!["rodeos:interfaceProtocols"])).toMatchObject(
      { kind: "enum", isList: true }
    )
    expect(enumValues(software.optional!["rodeos:requiredObjectKnowledge"])).toEqual([
      "none",
      "category",
      "cadModel",
      "trainedModel",
    ])
    expect(software.optional!["rodeos:supportsContinuousLearning"]).toBe("xsd:boolean")
  })

  it("knows pose estimation and the other perception tasks", () => {
    const perception = software.instances!["rodeos:perceptionVisionSoftware"]
    const values = enumValues(perception.mandatory!["rodeos:perceptionVisionSoftwareType"])
    for (const v of [
      "objectDetection",
      "instanceSegmentation",
      "poseEstimation",
      "graspPointDetection",
      "calibration",
      "labelingAnnotation",
    ]) {
      expect(values).toContain(v)
    }
    expect(perception.defaultValues!["rodeos:aasSubmodel"]).toBe(AI_DEPLOYMENT)
  })

  it("extends the AI analytics types", () => {
    const ai = software.instances!["rodeos:aiAnalyticsSoftware"]
    const values = enumValues(ai.mandatory!["rodeos:aiAnalyticsSoftwareType"])
    for (const v of [
      "mlModel",
      "foundationModel",
      "llmApplication",
      "uncertaintyQuantification",
      "dataAnalyticsPipeline",
      "dataLabeling",
    ]) {
      expect(values).toContain(v)
    }
    expect(ai.defaultValues!["rodeos:aasSubmodel"]).toBe(AI_DEPLOYMENT)
  })

  it("adds the three new sub-types with a type enum and an AAS default", () => {
    const expected: Array<[string, string]> = [
      ["rodeos:manipulationPlanningSoftware", "rodeos:manipulationPlanningSoftwareType"],
      ["rodeos:taskPlanningSoftware", "rodeos:taskPlanningSoftwareType"],
      ["rodeos:engineeringCommissioningSoftware", "rodeos:engineeringCommissioningSoftwareType"],
    ]
    for (const [key, typeField] of expected) {
      const node = software.instances![key]
      expect(node, key).toBeDefined()
      expect(parseFieldType(node.mandatory![typeField]).kind).toBe("enum")
      expect(node.mandatory!["rodeos:aasSubmodel"]).toBe("xsd:anyUri")
      expect(node.defaultValues!["rodeos:aasSubmodel"]).toMatch(/^https:\/\//)
    }
  })

  it("contains only parseable field types", () => {
    const visit = (node: ModelNode, where: string) => {
      for (const [name, type] of Object.entries({
        ...node.mandatory,
        ...node.optional,
      })) {
        expect(type, `${where}.${name}`).toMatch(
          /^(List\[)?(xsd:|skos:|schema:|enum\[|rodeos:)/
        )
        if (type.includes("enum[")) {
          expect(parseFieldType(type).enumValues.length, `${where}.${name}`).toBeGreaterThan(0)
        }
      }
      for (const [key, child] of Object.entries(node.instances ?? {})) {
        visit(child, `${where}/${key}`)
      }
    }
    visit(root, "dcat:Resource")
  })
})
