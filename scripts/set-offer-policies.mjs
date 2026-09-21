#!/usr/bin/env node
/**
 * Change the policies of existing offers in the DLR dataspace.
 *
 *   node scripts/set-offer-policies.mjs --access=<id> --contract=<id> [--apply] <asset.json> [...]
 *
 * Without --apply this only reports what would change.
 *
 * Why this exists: the ACCESS policy decides who may SEE an offer — a
 * connector withholds datasets from a catalog request whose access policy the
 * requester does not satisfy, and the federated catalog is a central crawl, so
 * a group-restricted access policy hides the asset from that catalog for
 * everyone, members of that group included. A group restriction belongs on the
 * CONTRACT policy, which decides who may NEGOTIATE. Registering with one id for
 * both puts the restriction in the wrong place; this script repairs that
 * without deleting or re-uploading anything.
 *
 * Reads DATASPACE_API_URL, DATASPACE_API_KEY and DATASPACE_CONNECTOR from .env.
 */
import { readFile } from "node:fs/promises"

const EDC = "https://w3id.org/edc/v0.0.1/ns/"

const args = process.argv.slice(2)
const flag = (name) =>
  args.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=")
const access = flag("access")
const contract = flag("contract")
const apply = args.includes("--apply")
const names = args.filter((a) => !a.startsWith("--"))

if (!access || !contract || names.length === 0) {
  console.error(
    "usage: node scripts/set-offer-policies.mjs --access=<id> --contract=<id> [--apply] <asset.json>..."
  )
  process.exit(2)
}

// Minimal .env reader — the app uses Next.js's own loader, scripts do not.
const env = {}
try {
  for (const line of (await readFile(".env", "utf8")).split("\n")) {
    const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/.exec(line)
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "")
  }
} catch {
  /* fall through to process.env */
}
const base = (process.env.DATASPACE_API_URL ?? env.DATASPACE_API_URL ?? "").replace(/\/$/, "")
const key = process.env.DATASPACE_API_KEY ?? env.DATASPACE_API_KEY
const connector = process.env.DATASPACE_CONNECTOR ?? env.DATASPACE_CONNECTOR

if (!base || !key || !connector) {
  console.error("DATASPACE_API_URL, DATASPACE_API_KEY and DATASPACE_CONNECTOR must be set (.env)")
  process.exit(2)
}

const mgmt = (path, init = {}) =>
  fetch(`${base}/connectors/${connector}/cp/management/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  })

const asList = (v) => (v === undefined ? [] : Array.isArray(v) ? v : [v])

const defsRes = await mgmt("v3/contractdefinitions/request", {
  method: "POST",
  body: JSON.stringify({ "@context": { "@vocab": EDC }, "@type": "QuerySpec", limit: 500 }),
})
if (!defsRes.ok) {
  console.error(`cannot read contract definitions (${defsRes.status})`)
  process.exit(1)
}
const definitions = asList(await defsRes.json())

let changed = 0
let failed = 0
for (const name of names) {
  // A definition points at its asset through the selector, so resolve each
  // candidate's asset and match on the name the dataspace shows.
  let match
  for (const def of definitions) {
    const assetId = asList(def.assetsSelector).find(
      (c) => String(c.operandLeft).endsWith("id")
    )?.operandRight
    if (!assetId) continue
    const res = await mgmt(`v3/assets/${assetId}`)
    if (!res.ok) continue
    const asset = await res.json()
    const assetName = asset.properties?.name ?? asset.properties?.[`${EDC}name`]
    if (assetName === name) {
      match = { def, assetId }
      break
    }
  }

  if (!match) {
    console.error(`✗ ${name}: no contract definition found for this asset`)
    failed++
    continue
  }

  const { def, assetId } = match
  const before = `${def.accessPolicyId} / ${def.contractPolicyId}`
  if (def.accessPolicyId === access && def.contractPolicyId === contract) {
    console.log(`= ${name}: already access ${access} / contract ${contract}`)
    continue
  }

  if (!apply) {
    console.log(`→ ${name}: ${before}  ⇒  ${access} / ${contract}   (dry run, pass --apply)`)
    continue
  }

  const res = await mgmt("v3/contractdefinitions", {
    method: "PUT",
    body: JSON.stringify({
      "@context": { "@vocab": EDC },
      "@id": def["@id"],
      "@type": "ContractDefinition",
      accessPolicyId: access,
      contractPolicyId: contract,
      assetsSelector: [
        {
          "@type": "Criterion",
          operandLeft: `${EDC}id`,
          operator: "=",
          operandRight: assetId,
        },
      ],
    }),
  })
  if (!res.ok) {
    console.error(`✗ ${name}: update failed (${res.status}) ${(await res.text()).slice(0, 200)}`)
    failed++
    continue
  }
  console.log(`✓ ${name}: ${before}  ⇒  ${access} / ${contract}`)
  changed++
}

if (apply) console.log(`\n${changed} definition(s) updated`)
process.exit(failed ? 1 : 0)
