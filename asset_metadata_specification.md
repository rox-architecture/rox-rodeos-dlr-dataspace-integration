# Required Metadata Fields for KITs

> Reference copy of the KIT asset metadata specification this repository
> implements. `operational_model.json` mirrors the fields below;
> `lib/kit-metadata.ts` maps the RODEOS CURIEs onto the names used here.

First, every asset is categorised into one of the below types:

1. **Static File**: A finite data artifact that can be directly transferred (e.g., CSV, JSON, images)
2. **Container**: An executable software package distributed as a container image (e.g., Docker/Archive/OCI image)
3. **Data Service**: A service endpoint that returns a finite file upon invocation (e.g., image conversion, report generation)
4. **Streaming Service**: A service endpoint that provides a continuous stream of data (e.g., camera feed)
5. **Workflow**: A JSON-encoded workflow graph that defines the composition, dependencies, and execution order of assets in a pipeline.

So, what should be in the asset metadata?

- Common metadata for all types
- Type-specific metadata for each type

## Common Metadata

| Field                   | Type          | Required | Description                                                                 |
| ----------------------- | ------------- | :------: | --------------------------------------------------------------------------- |
| `operational_type`      | `enum`        |    ✅    | {`static_file`, `container`, `file_service`, `streaming_service`, `workflow`}|
| `contact_email`         | `string`      |          | Email address of the contact person responsible for maintaining the asset.  |
| `hardware_requirements` | `JSON object` |          | Minimum hardware required to use this asset                                 |
| `software_requirements` | `JSON object` |          | Required software, runtime, drivers, or platform dependencies.              |
| `dataspace_requirements`| `JSON object` |          | Required dataspace connectors and negotiations.                             |
| `description`           | `string`      |          | Note: this is not required if it is already in the semantic model           |

`hardware_requirements`, `software_requirements`, and `dataspace_requirements`
uses a small domain specific language, shown at the end of this document.

## Type-Specific Metadata

### Static File

| Field                   | Type          | Required | Description                                                                 |
| ----------------------- | ------------- | :------: | --------------------------------------------------------------------------- |
| `file_format`           | `string`      |    ✅    | File format (e.g., `csv`, `json`, `jpg`, `mp4`).                            |
| `file_size`             | `integer`     |          | Size of the file in bytes.                                                  |
| `checksum`              | `string`      |          | SHA-256 checksum used to verify file integrity.                             |
| `encoding`              | `string`      |          | Character encoding for text-based files (e.g., `UTF-8`).                    |

### Container

| Field                   | Type          | Required | Description                                                                                      |
| ----------------------- | ------------- | :------: | ------------------------------------------------------------------------------------------------ |
| `distribution_type`     | `enum`        |    ✅    | Distribution method of the container asset: `oci_registry`, `archive`, or `dockerfile`.          |
| `image_name`            | `string`      |    ✅    | Name of the container image (e.g., `object-detector`).                                           |
| `image_tag`             | `string`      |    ✅    | Tag identifying a specific image version (e.g., `1.2.0`, `latest`).                              |
| `platforms`             | `set<enum>`   |    ✅    | Supported target platforms: `linux/amd64`, `linux/arm64`, `windows/amd64`, `windows/arm64`.      |

### Data Service

| Field                   | Type          | Required | Description                                                                                      |
| ----------------------- | ------------- | :------: | ------------------------------------------------------------------------------------------------ |
| `data_format`           | `string`      |    ✅    | Format of the file returned by the service (e.g., `csv`, `json`, `jpg`, `mp4`).                  |
| `request_method`        | `enum`        |    ✅    | HTTP method used to invoke the service (e.g., `GET`, `POST`).                                    |
| `subpath`               | `string`      |    ✅    | Relative API path appended to the service endpoint (e.g., `/convert`, `/reports/generate`).      |
| `request_schema`        | `JSON object` or `URI` |          | request body schema.                                                                    |
| `response_schema`       | `JSON object` or `URI` |          | response body schema.                                                                   |
| `api_url`               | `URI`         |          | URL to API documentation (e.g., Swagger or OpenAPI documents).                                   |

### Streaming Service

Identical to `Data Service` type metadata.

| Field                   | Type          | Required | Description                                                                                      |
| ----------------------- | ------------- | :------: | ------------------------------------------------------------------------------------------------ |
| `data_format`           | `string`      |    ✅    | Format of the file returned by the service (e.g., `csv`, `json`, `jpg`, `mp4`).                  |
| `request_method`        | `enum`        |    ✅    | HTTP method used to invoke the service (e.g., `GET`, `POST`).                                    |
| `subpath`               | `string`      |    ✅    | Relative API path appended to the service endpoint (e.g., `/convert`, `/reports/generate`).      |
| `request_schema`        | `JSON object` or `URI` |          | request body schema.                                                                    |
| `response_schema`       | `JSON object` or `URI` |          | response body schema.                                                                   |
| `api_url`               | `URI`         |          | URL to API documentation (e.g., Swagger or OpenAPI documents).                                   |

### Workflow

No need for RODEOS.

## Requirement Expression

```
hardware_requirements: list
├── requirement: dict
│   ├── subject: string
│   ├── operator: string
│   └── value: string
└── ...

software_requirements: list
├── requirement: dict
│   ├── subject: string
│   ├── operator: string
│   └── value: string
└── ...

dataspace_requirements: list
├── requirement: dict
│   ├── subject: string
│   ├── operator: string
│   └── value: string
└── ...
```

Each Requirement Item must always have `subject` and `operator` elements.
Meanwhile, the `value` element is optional depending on the `operator`.
They are explained below.

### Requirement Item Element: `Subject`

Namespace values. Always start with one of `hardware`, `software`, `dataspace`.
There is no fixed values, so users and RODEOS can generate subject freely.

Something like below:

```
hardware
├── compute
│   ├── cpu
│   ├── memory
│   └── gpu
├── robot
├── end_effector
├── sensor
│   ├── camera
│   ├── lidar
│   ├── radar
│   ├── imu
│   ├── force_torque
│   ├── proximity
│   └── encoder
└── interface
    ├── usb
    ├── ethernet
    ├── serial
    ├── i2c
    └── gpio

software
├── os
├── runtime
├── framework
├── middleware
├── api
├── service
├── network
├── filesystem
├── package
└── permission

dataspace
├── connector
├── policy.access
├── negotiation
├── transfer
└── permission
```

### Requirement Item Element: `Operator`

| Expression             | Description                                                                   |
| ------------------     | ----------------------------------------------------------------------------- |
| `x required`           | The specified resource, API, service, or interface must be available for use. |
| `x required for y`     | x must be available/performed for y.                                          |
| `x = value`            | The specified property must have the exact value.                             |
| `x >= value`           | The specified property must meet the minimum value.                           |
| `x <= value`           | The specified property must not exceed the maximum value.                     |
| `x in {a, b, ...}`     | The specified property must match one of the listed values.                   |

A quick example:

```text
software.kubernetes.api required
hardware.memory >= 8 GB
hardware.cpu.architecture in {amd64, arm64}
software.runtime.python >= 3.12
dataspace.connector.dlr required
dataspace.negotiation.dlr required for provider.asset_id
```

Technically, users can also use custom operators (any string).

For example:
```text
software.kubernetes.api is not required
```

### Requirement Item Element: `Value`

`Value` can be any string, and can be optional in the requirement item. Consider the below Requirement Item examples:

- `software.kubernetes.api required`
    - value: None
- `hardware.memory >= 8 GB`
    - value: 8 GB
- `hardware.cpu.architecture in {amd64, arm64}`
    - value: {amd64, arm64}
- `dataspace.negotiation.dlr required for provider.asset_id`
    - value: provider.asset_id
    - for instance: BPN192385439.this_is_my_asset

## Note:

- For indicating dataspace assets, we always use a namespace format: provider.asset_id

## Open points for RODEOS

Two questions this repository could not decide on its own:

1. **Physical components.** A gripper or a robot arm is neither transferable
   nor an endpoint, yet `operational_type` is required. This implementation
   catalogues them as `static_file` (the dataspace carries the description),
   which is a placeholder until the specification says otherwise.
2. **Array shape in the EDC.** The connector compacts single-element arrays
   to scalars, so `hardware_requirements` with one entry arrives as an object
   rather than a list. Registered assets therefore also carry
   `kitMetadataJson`, the same document as a string, for consumers that need
   one stable shape.
