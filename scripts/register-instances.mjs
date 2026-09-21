#!/usr/bin/env node
/**
 * Register instance documents through a running RODEOS app.
 *
 *   node scripts/register-instances.mjs [--dry-run] [--base=http://localhost:3000]
 *        [--policy=<id> | --access-policy=<id> --contract-policy=<id>] <instance.json> [...]
 *
 * --dry-run          validate only (works without dataspace configuration)
 * --policy           use this policy id as both access and contract policy
 * --access-policy    who may SEE the offer in the catalog — a restrictive one
 *                    here hides the asset from the federated catalog entirely
 * --contract-policy  who may NEGOTIATE it; this is where a group restriction
 *                    belongs, so the offer stays findable
 *
 * Files still containing the token PLACEHOLDER are validated but never
 * registered — the values have to be replaced first.
 */
import { readFile } from "node:fs/promises"
import { basename } from "node:path"

const args = process.argv.slice(2)
const flag = (name) =>
  args.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=")
const dryRun = args.includes("--dry-run")
const base = (
  flag("base") ?? process.env.RODEOS_BASE_URL ?? "http://localhost:3000"
).replace(/\/$/, "")
const policy = flag("policy")
const accessPolicy = flag("access-policy") ?? policy
const contractPolicy = flag("contract-policy") ?? policy
const files = args.filter((a) => !a.startsWith("--"))

// The API refuses a half-given override, so say so before reading any file.
if (Boolean(accessPolicy) !== Boolean(contractPolicy)) {
  console.error(
    "--access-policy and --contract-policy have to be given together (or use --policy for both)"
  )
  process.exit(2)
}

if (files.length === 0) {
  console.error(
    "usage: node scripts/register-instances.mjs [--dry-run] [--base=URL] " +
      "[--policy=ID | --access-policy=ID --contract-policy=ID] <instance.json>..."
  )
  process.exit(2)
}

let failed = 0
for (const file of files) {
  const name = basename(file)
  let text
  try {
    text = await readFile(file, "utf8")
  } catch (err) {
    console.error(`✗ ${name}: cannot read file (${err.message})`)
    failed++
    continue
  }

  if (!dryRun && /PLACEHOLDER/.test(text)) {
    console.error(
      `✗ ${name}: still contains PLACEHOLDER values — replace them before registering`
    )
    failed++
    continue
  }

  let instance
  try {
    instance = JSON.parse(text)
  } catch (err) {
    console.error(`✗ ${name}: not valid JSON (${err.message})`)
    failed++
    continue
  }

  const body = { instance, dryRun }
  if (accessPolicy)
    body.policies = {
      accessPolicyId: accessPolicy,
      contractPolicyId: contractPolicy,
    }

  let res, json
  try {
    res = await fetch(`${base}/api/dataspace/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    json = await res.json().catch(() => ({}))
  } catch (err) {
    console.error(
      `✗ ${name}: cannot reach ${base} (${err.message}) — is the app running?`
    )
    failed++
    continue
  }

  if (!res.ok) {
    console.error(`✗ ${name} (${res.status}): ${json.error ?? "unknown error"}`)
    for (const m of json.missing ?? []) console.error(`    missing  ${m}`)
    for (const [k, v] of Object.entries(json.invalid ?? {}))
      console.error(`    invalid  ${k}: ${v}`)
    failed++
    continue
  }

  const verb = dryRun ? "valid     " : "registered"
  console.log(`✓ ${verb} ${name} → ${json.filename}  [${json.kitMetadata}]`)
  if (json.path)
    console.log(
      `    path: ${json.path.join(" → ")}  |  ${json.operationalPath.join(" → ")}`
    )
  if (json.unknown?.length)
    console.log(`    unknown keys kept as-is: ${json.unknown.join(", ")}`)
  if (!dryRun)
    console.log(
      `    connector ${json.connector}, access ${json.accessPolicyId} / contract ${json.contractPolicyId} (${json.policySource})`
    )
}

process.exit(failed ? 1 : 0)
