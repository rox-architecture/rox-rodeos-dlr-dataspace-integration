import { describe, expect, it } from "vitest"
import {
  autoSelectorField,
  autoSelectorValuesForPath,
  computeLevels,
  OPERATIONAL_AXIS,
  parseFieldType,
  SEMANTIC_AXIS,
  type Axis,
  type ModelNode,
} from "@/lib/semantic-model"

/** Every instance path of an axis: the key chain at every node below the root. */
function allPaths(axis: Axis): string[][] {
  const paths: string[][] = []
  const walk = (node: ModelNode, path: string[]) => {
    for (const [key, child] of Object.entries(node.instances ?? {})) {
      const next = [...path, key]
      paths.push(next)
      walk(child, next)
    }
  }
  walk(axis.root, [])
  return paths
}

/** Every node of an axis together with the path that leads to it. */
function allNodes(axis: Axis): { path: string[]; node: ModelNode }[] {
  const nodes = [{ path: [] as string[], node: axis.root }]
  for (const path of allPaths(axis)) {
    let node = axis.root
    for (const key of path) node = node.instances![key]
    nodes.push({ path, node })
  }
  return nodes
}

const AXES = [SEMANTIC_AXIS, OPERATIONAL_AXIS]

describe("software sub-type auto-selection", () => {
  it("reaches perceptionVisionSoftware from field values alone", () => {
    const levels = computeLevels(
      {
        "rodeos:coreType": "Component",
        "rodeos:componentType": "softwareComponent",
        "rodeos:softwareAssetType": "perceptionVisionSoftware",
      },
      {},
      SEMANTIC_AXIS
    )
    expect(levels.at(-1)!.path).toEqual([
      "rodeos:Component",
      "rodeos:softwareComponent",
      "rodeos:perceptionVisionSoftware",
    ])
    // No manual selector is offered on the softwareComponent level any more.
    expect(levels[2].selectionOptions).toBeNull()
  })

  it("derives auto-selector values for a software path", () => {
    expect(
      autoSelectorValuesForPath([
        "rodeos:Component",
        "rodeos:softwareComponent",
        "rodeos:aiAnalyticsSoftware",
      ])
    ).toEqual({
      values: {
        "rodeos:coreType": "Component",
        "rodeos:componentType": "softwareComponent",
        "rodeos:softwareAssetType": "aiAnalyticsSoftware",
      },
      selections: {},
    })
  })

  it("keeps manual selections for hardware paths", () => {
    expect(
      autoSelectorValuesForPath([
        "rodeos:Component",
        "rodeos:hardwareComponent",
        "rodeos:roboter",
        "rodeos:stationaryRobot",
      ])
    ).toEqual({
      values: {
        "rodeos:coreType": "Component",
        "rodeos:componentType": "hardwareComponent",
      },
      selections: {
        "rodeos:Component/rodeos:hardwareComponent": "rodeos:roboter",
        "rodeos:Component/rodeos:hardwareComponent/rodeos:roboter":
          "rodeos:stationaryRobot",
      },
    })
  })
})

describe("auto-selector invariants (adding one = touching Axis.autoSelectors)", () => {
  it("round-trips every path of both axes through autoSelectorValuesForPath → computeLevels", () => {
    for (const axis of AXES) {
      const paths = allPaths(axis)
      expect(paths.length).toBeGreaterThan(0)
      for (const p of paths) {
        const s = autoSelectorValuesForPath(p, axis)
        expect(
          computeLevels(s.values, s.selections, axis).at(-1)!.path,
          `${axis.id}: ${p.join("/")}`
        ).toEqual(p)
      }
    }
  })

  it("auto-selector enum literals equal the child instance keys on every node that has one", () => {
    let checked = 0
    for (const axis of AXES) {
      for (const { path, node } of allNodes(axis)) {
        const auto = autoSelectorField(node, axis.autoSelectors)
        if (!auto || !node.instances) continue
        checked++
        const type = { ...node.mandatory, ...node.optional }[auto]
        const literals = [...(parseFieldType(type).enumValues ?? [])].sort()
        const children = Object.keys(node.instances)
          .map((k) => k.replace(/^rodeos:/, ""))
          .sort()
        expect(literals, `${axis.id}: ${path.join("/") || "root"} (${auto})`).toEqual(
          children
        )
      }
    }
    // Root coreType, componentType, softwareAssetType, operationalType.
    expect(checked).toBeGreaterThanOrEqual(4)
  })

  it("derives the operational auto-selector value", () => {
    expect(autoSelectorValuesForPath(["rodeos:container"], OPERATIONAL_AXIS)).toEqual({
      values: { "rodeos:operationalType": "container" },
      selections: {},
    })
  })

  it("stops at the first key the model does not know", () => {
    expect(
      autoSelectorValuesForPath([
        "rodeos:Component",
        "rodeos:doesNotExist",
        "rodeos:softwareComponent",
      ])
    ).toEqual({
      values: { "rodeos:coreType": "Component" },
      selections: {},
    })
  })

  it("only claims the auto-selector fields the path actually decided", () => {
    // A path that stops at softwareComponent has not chosen a sub-type, so an
    // LLM-supplied rodeos:softwareAssetType must still be free to be applied.
    const { values } = autoSelectorValuesForPath([
      "rodeos:Component",
      "rodeos:softwareComponent",
    ])
    expect(Object.keys(values).sort()).toEqual([
      "rodeos:componentType",
      "rodeos:coreType",
    ])
    expect("rodeos:softwareAssetType" in values).toBe(false)
  })
})
