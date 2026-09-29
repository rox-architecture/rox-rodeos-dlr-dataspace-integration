import { describe, expect, it } from "vitest"
import { parseFieldType } from "@/lib/semantic-model"

describe("test setup", () => {
  it("resolves the @ alias and parses a field type", () => {
    expect(parseFieldType("List[enum[a, b]]")).toMatchObject({
      kind: "enum",
      isList: true,
      enumValues: ["a", "b"],
    })
  })
})
