# RODEOS × RoX — Semantic Model Generator

**RObotic Data EcOsystem Semantic Model** for the RoX / DLR dataspace — a
Next.js application to create RODEOS-compliant semantic descriptions of
robotic assets, either **manually** through a dynamic form or **LLM-assisted**
from pasted technical documentation.

RODEOS is a vendor-neutral semantic blueprint that extends **W3C DCAT-3** with
robotics-specific classes. Every asset in the dataspace is described as a
`dcat:Resource` and classified as a **Dataset**, **Component** (hardware or
software, down to concrete robot, tooling, controller and sensor types) or
**Service**.

## ⭐ The semantic model

> **[`semantic_model.json`](./semantic_model.json)** — the heart of this
> repository.

This single file defines the complete RODEOS hierarchy: mandatory and optional
fields per level, data types (`xsd:*`, `skos:concept`, `enum[…]`, `List[…]`),
default values and AAS submodel references. **Everything in the application is
derived from it at build time** — the form structure, the validation rules and
the LLM extraction prompt. Change the model, restart the app, and the UI
adapts; no code changes required.

The running app also serves it at [`/api/semantic-model`](http://localhost:3000/api/semantic-model).

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Configure API keys / models
cp .env.example .env        # then edit .env

# 3a. Development
npm run dev                 # http://localhost:3000

# 3b. Production / kiosk mode (fullscreen local app)
npm run build
npm run kiosk
```

### Configuration (`.env`)

| Variable | Default | Purpose |
|---|---|---|
| `RODEOS_LLM_PROVIDER` | `openrouter` | `openrouter` (remote, reference setup) or `ollama` (fully local) |
| `OPENROUTER_API_KEY` | — | Key from [openrouter.ai/keys](https://openrouter.ai/keys), required for the default provider |
| `RODEOS_DEFAULT_MODEL` | `openai/gpt-4o-mini` | Reference model for AI autofill (any OpenRouter model id) |
| `RODEOS_PDF_ENGINE` | `mistral-ocr` | PDF parsing engine for uploads: `mistral-ocr` (OCR, like the original pipeline) or `pdf-text` (free, born-digital PDFs) |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama server for local inference |
| `RODEOS_LOCAL_MODEL` | `qwen2.5:3b` | Default Ollama model |
| `DATASPACE_API_URL` | `https://vision-x-api.base-x-ecosystem.org` | DLR dataspace API endpoint |
| `DATASPACE_API_KEY` | — | Bearer token for the dataspace API (enables asset registration) |
| `DATASPACE_CONNECTOR` | — | Name of your connector in the dataspace |
| `DATASPACE_ACCESS_POLICY_ID` / `DATASPACE_CONTRACT_POLICY_ID` | — | Optional: pin the policies used for new offers |

**OpenRouter with the model from `RODEOS_DEFAULT_MODEL` is the reference and
default configuration.** Ollama is the privacy-first alternative for fully
local operation (`ollama serve`, e.g. `ollama pull qwen2.5:3b`); provider and
model can also be switched per request directly in the UI.

## Using the app

1. **Manual authoring** — fill in the mandatory DCAT resource fields; choosing
   `rodeos:coreType` (Dataset / Component / Service) unfolds the next level of
   the hierarchy. Components branch into hardware/software and further into
   concrete types (AGV, articulated robot, gripper, LiDAR, PLC, …). Every
   field is validated against its declared type (`xsd:anyUri` fields also
   accept email addresses, e.g. for `dcat:contactPoint`); model-defined
   defaults (e.g. AAS submodels) are prefilled. **Empty mandatory fields are
   outlined red** until they hold a valid value, so it is always visible what
   still blocks a complete instance.
2. **AI autofill** — upload a technical document (PDF, Markdown or TXT; PDFs
   are converted to markdown by the LLM in the background) or paste text into
   the assist panel. The LLM classifies the asset within the hierarchy,
   selects the path and fills all extractable fields. The LLM separates two
   certainty levels: document-supported facts are entered normally, while
   **plausible proposals for mandatory fields the document does not state are
   outlined amber** ("AI suggestion — please verify") until you confirm them
   by editing the field. The result is fully editable afterwards — the LLM
   only ever *proposes*, the form remains the source of truth. LLM-based PDF
   extraction runs via OpenRouter; for fully local Ollama use, upload
   .md/.txt or paste text.
3. **Export** — the generated instance is previewed live as JSON, with
   completeness tracking of mandatory fields, and can be copied or downloaded.
4. **Register in the dataspace** — once all mandatory fields are valid, the
   green *Register asset in Data Space* button publishes the instance to the
   DLR dataspace (see below).

## Registering assets in the DLR dataspace

The app integrates with the **DLR dataspace** (Vision-X / base-x-ecosystem,
operated by the DLR Institute for AI Safety and Security):

- Dashboard: <https://vision-x-dataspace.base-x-ecosystem.org/#/dashboard>
- Onboarding docs: <https://vision-x-dataspace.github.io/dlr-dataspace-onboarding/>
- API docs: <https://vision-x-api.base-x-ecosystem.org/docs>

*Register asset in Data Space* performs the same flow as the dashboard's
"Your Assets" page, fully automated:

1. **Upload** — requests a presigned upload URL for your connector
   (`GET /ui/{connector}/files/upload/{filename}`) and uploads the generated
   instance as `<dcterms:identifier>.json` to the connector storage.
2. **Policies** — resolves the access & contract policy for the offer:
   IDs pinned in `.env` win; otherwise the connector's first existing policy
   is reused; if the connector has no policies yet, a permissive default
   access policy (ODRL `cx-policy:access`) is created.
3. **Offer** — creates the data offer (`POST /ui/{connector}/assets`) with
   name, description, `offerType: data` and RODEOS metadata, making the asset
   visible in the federated catalog.

Setup: create an API key in the dataspace, set `DATASPACE_API_KEY` and
`DATASPACE_CONNECTOR` in `.env` and restart the app. The button stays
disabled (with a hint) until both are configured and reports the created
asset with a link to the dashboard on success. Registration requires all
mandatory fields of the instance to be valid.

> **Connector requirement:** file upload needs a **storage-backed connector**
> (`AmazonS3` or `AzureStorage`). `HttpData` connectors have no file storage
> — the dataspace API answers `501 Not implemented` for their upload URL. If
> your connector is HttpData, create an additional S3-backed connector in the
> dashboard (*Dashboard → Connectors*, storage type Amazon S3 with bucket
> credentials) and point `DATASPACE_CONNECTOR` to it. The app checks this
> upfront and tells you the connector type in its error message.

> **Federated catalog visibility:** the federated catalog is a cache filled
> by a crawler on the operator side. Offers of a **freshly created connector
> may not appear immediately**, even though asset, contract and directory
> entries (BPN/DID) are all correct — the crawler picks new connectors up
> with a later crawl cycle. If your offer is still missing after a day,
> contact the dataspace operators (DLR Institute for AI Safety and Security)
> and ask them to include your connector in the federated catalog crawler.

## Kiosk mode (Mac / Windows / Linux)

`npm run kiosk` starts the production server and opens a Chromium-based
browser (Chrome, Edge, Chromium, Brave — auto-detected, override with
`KIOSK_BROWSER=/path`) in fullscreen kiosk mode. Alternatively, open the app
in any browser and use the fullscreen button in the header.

## Project structure

```
semantic_model.json      ⭐ the RODEOS semantic model — single source of truth
app/
  page.tsx               main UI (header, form, footer)
  api/autofill/          LLM extraction endpoint (OpenRouter / Ollama)
  api/config/            exposes the active LLM configuration to the UI
  api/semantic-model/    serves semantic_model.json
components/rodeos/       dynamic form, AI assist panel, JSON preview
components/ui/           shadcn components (Base UI)
lib/semantic-model.ts    model parsing, type system, validation, hierarchy
lib/llm.ts               provider abstraction (OpenRouter / Ollama)
scripts/kiosk.mjs        cross-platform kiosk launcher
design/                  RoX design system (tokens, previews, brand assets)
```

## Background

This application supersedes the original Python/Streamlit implementation of
RODEOS (LLM pipeline for PDF → markdown → chunking → semantic model →
knowledge graph). The interactive authoring UI and the LLM-assisted semantic
model instantiation are fully covered here; the app is self-contained and has
no Python dependencies.

## Funding

Developed within the [RoX project](https://www.project-rox.ai/en/) —
*Digital Ecosystem for AI-based Robotics*. This project has received public
funding from the **European Union — NextGenerationEU** within the Important
Project of Common European Interest – Cloud Infrastructures and Services
(IPCEI-CIS) under grant agreement 13IPC034, via the German Federal Ministry
for Economic Affairs.

<p align="center">
  <img alt="EU NextGenerationEU and BMWK funding marks" src="public/rox/funding-combined.png" width="360"/>
</p>
