import { semanticModel } from "@/lib/semantic-model"

/**
 * Serves the semantic model (semantic_model.json at the repository root) so
 * external tools can consume the exact schema this UI is built from.
 */
export async function GET() {
  return Response.json(semanticModel)
}
