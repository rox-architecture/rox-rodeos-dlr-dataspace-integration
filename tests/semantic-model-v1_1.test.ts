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
const TECHNICAL_DATA =
  "https://raw.githubusercontent.com/admin-shell-io/submodel-templates/refs/heads/main/published/Technical_Data/2/0/IDTA%2002003_Sample_TechnicalData.json"

/**
 * Every type atom parseFieldType understands, optionally wrapped in List[…].
 * A typo in a new field type (or a type the app cannot render) fails here.
 */
const FIELD_TYPE =
  /^(List\[)?(xsd:text|xsd:integer|xsd:decimal|xsd:boolean|xsd:anyUri|xsd:hexBinary|xsd:duration|skos:concept|schema:quantitativeValue|rodeos:jsonOrUri|rodeos:Requirement\[[a-z]+\]|enum\[[^\]]+\])\]?$/

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

  it("lists the software sub-types in the order of the softwareAssetType enum", () => {
    const values = enumValues(software.mandatory!["rodeos:softwareAssetType"])
    expect(Object.keys(software.instances!)).toEqual(
      values.map((v) => `rodeos:${v}`)
    )
  })

  it("requires a capability class matching the TP3.X building-block classes", () => {
    const values = enumValues(software.mandatory!["rodeos:capabilityClass"])
    expect([...values].sort()).toEqual(
      [
        "hardwareAccess",
        "perception",
        "manipulation",
        "processExecution",
        "humanRobotInteraction",
        "foundationModel",
      ].sort()
    )
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
    const protocols = parseFieldType(software.optional!["rodeos:interfaceProtocols"])
    expect(protocols).toMatchObject({ kind: "enum", isList: true })
    expect(protocols.enumValues).toEqual([
      "REST",
      "gRPC",
      "OPC-UA",
      "TCP-Socket",
      "ROS2",
      "MQTT",
      "WebSocket",
      "Python-API",
      "CLI",
    ])
    // Ordinal progression — the order is part of the contract.
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
    ]) {
      expect(values).toContain(v)
    }
    // Labeling / annotation tooling has a single home: aiAnalyticsSoftware / dataLabeling.
    expect(values).not.toContain("labelingAnnotation")
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
    const expected: Array<[string, string, string[], string]> = [
      [
        "rodeos:manipulationPlanningSoftware",
        "rodeos:manipulationPlanningSoftwareType",
        [
          "graspPlanning",
          "pickPlanning",
          "packPlanning",
          "assemblySequencePlanning",
          "forceControlledJoining",
        ],
        AI_DEPLOYMENT,
      ],
      [
        "rodeos:taskPlanningSoftware",
        "rodeos:taskPlanningSoftwareType",
        [
          "symbolicPlanning",
          "llmBasedPlanning",
          "hybridPlanning",
          "schedulingOptimization",
        ],
        AI_DEPLOYMENT,
      ],
      [
        "rodeos:engineeringCommissioningSoftware",
        "rodeos:engineeringCommissioningSoftwareType",
        [
          "reachabilityAnalysis",
          "cellLayoutPlanning",
          "riskAssessment",
          "safetyConfiguration",
          "teaching",
        ],
        TECHNICAL_DATA,
      ],
    ]
    for (const [key, typeField, literals, aasDefault] of expected) {
      const node = software.instances![key]
      expect(node, key).toBeDefined()
      const parsed = parseFieldType(node.mandatory![typeField])
      expect(parsed.kind, typeField).toBe("enum")
      expect(parsed.enumValues, typeField).toEqual(literals)
      expect(node.mandatory!["rodeos:aasSubmodel"], key).toBe("xsd:anyUri")
      expect(node.defaultValues!["rodeos:aasSubmodel"], key).toBe(aasDefault)
    }
  })

  it("contains only field types the app understands, with defaults on declared fields", () => {
    const visit = (node: ModelNode, where: string) => {
      const fields = { ...node.mandatory, ...node.optional }
      for (const [name, type] of Object.entries(fields)) {
        expect(type, `${where}.${name}`).toMatch(FIELD_TYPE)
        if (type.includes("enum[")) {
          expect(parseFieldType(type).enumValues.length, `${where}.${name}`).toBeGreaterThan(0)
        }
      }
      for (const name of Object.keys(node.defaultValues ?? {})) {
        expect(Object.keys(fields), `${where} defaultValues.${name}`).toContain(name)
      }
      for (const [key, child] of Object.entries(node.instances ?? {})) {
        visit(child, `${where}/${key}`)
      }
    }
    visit(root, "dcat:Resource")
  })
})
