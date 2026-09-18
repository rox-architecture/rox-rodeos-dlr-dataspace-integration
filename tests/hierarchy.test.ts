import { describe, expect, it } from "vitest"
import {
  autoSelectorValuesForPath,
  computeLevels,
  SEMANTIC_AXIS,
} from "@/lib/semantic-model"

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
