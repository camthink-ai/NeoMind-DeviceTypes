# Milesight SensorDecoders to NeoMind DeviceTypes Converter

## Problem

The [Milesight-IoT/SensorDecoders](https://github.com/Milesight-IoT/SensorDecoders) repository contains ~126 LoRaWAN sensor decoder definitions across 14 device series. We need to convert these into NeoMind DeviceType JSON format so the NeoMind platform can recognize and display Milesight devices.

## Decision

Write a Node.js conversion script that pulls `*-codec.json` files from GitHub via `gh api`, transforms each into a NeoMind DeviceType JSON file, and updates the central `index.json` registry.

## Design

### Input: Milesight codec.json Structure

The Milesight repo (branch: `main`) organizes devices as:
```
<series-dir>/<model-dir>/  (e.g., em-series/em300-th/)
```

Series directories are **lowercase with hyphens** (e.g., `em-series`, `am-series`). Device subdirectories are also **lowercase with hyphens** (e.g., `em300-th`, `am307`).

Each device directory contains a `*-codec.json` file (naming pattern: `<model>-codec.json`) with an `object` array defining all data fields:

```json
{
  "version": "1.0.0",
  "bytes": "0175640367040104687B",
  "object": [
    {
      "id": "battery",
      "name": "Battery",
      "value": "100",
      "unit": "%",
      "access_mode": "R",
      "data_type": "NUMBER",
      "value_type": "UINT8"
    },
    {
      "id": "temperature_alarm_config.condition",
      "name": "Temperature Alarm Config (Condition)",
      "access_mode": "RW",
      "data_type": "ENUM",
      "value_type": "UINT8",
      "values": [
        { "value": 0, "name": "disable" },
        { "value": 1, "name": "below" }
      ],
      "reference": ["temperature_alarm_config.condition", "temperature_alarm_config.threshold_min"]
    }
  ]
}
```

Key fields per entry:
- `id` — field identifier (may use dot notation for nested objects; preserved as-is in NeoMind `name`)
- `name` — human-readable display name
- `unit` — measurement unit (may be empty string or absent)
- `access_mode` — "R" (read), "W" (write), "RW" (read-write)
- `data_type` — "NUMBER", "TEXT", "BOOL", "ENUM"
- `value_type` — "UINT8", "UINT16", "INT16", "FLOAT", "STRING", etc.
- `values` — (optional) array of `{value, name}` for ENUM and BOOL types
- `reference` — (optional) array of related field IDs for grouping (ignored during conversion)

### Output: NeoMind DeviceType JSON

Target format matching existing files (`ne101_camera.json`, `ne301_camera.json`):

```json
{
  "device_type": "milesight_em300_th",
  "name": "Milesight EM300-TH",
  "description": "Milesight EM300-TH LoRaWAN Sensor",
  "categories": ["LoRaWAN", "Sensor"],
  "mode": "simple",
  "metrics": [
    {
      "name": "battery",
      "display_name": "Battery",
      "data_type": "Integer",
      "unit": "%",
      "required": false
    },
    {
      "name": "temperature",
      "display_name": "Temperature",
      "data_type": "Float",
      "unit": "°C",
      "required": false
    }
  ],
  "uplink_samples": [],
  "commands": []
}
```

### Field Mapping

#### access_mode → metrics/commands routing

| access_mode | Target | Reason |
|---|---|---|
| `R` | `metrics[]` | Read-only telemetry data |
| `W` | `commands[].parameters[]` | Write-only control parameters |
| `RW` | `metrics[]` | Configurable parameters treated as writable metrics |

#### data_type mapping

| Milesight data_type | Milesight value_type | NeoMind data_type |
|---|---|---|
| NUMBER | FLOAT | "Float" |
| NUMBER | UINT8/UINT16/UINT32/INT8/INT16/INT32 | "Integer" |
| TEXT | STRING | "String" |
| BOOL | UINT8 | "Boolean" |
| ENUM | UINT8 | "String" |

#### Enum/BOOL values handling

For ENUM types: append value options to `display_name` as `"Options: 0=disable, 1=below, 2=above"`.

For BOOL types with `values` array: the `values` are ignored; `data_type` remains "Boolean".

#### required field

All converted metrics default to `"required": false`. LoRaWAN telemetry fields are optional in any given uplink, so this is the correct default.

#### unit field

When the source `unit` is empty string (`""`) or absent, the `unit` key is **omitted** from the output metric entirely.

#### Dot-notation IDs

Milesight `id` values are **preserved as-is** in the NeoMind `name` field, including dot notation (e.g., `temperature_alarm_config.condition` stays unchanged). This is consistent with existing NeoMind files that use dots like `metadata.image_id`.

#### reference grouping

The `reference` field in Milesight codec.json is **ignored** during conversion (added to Out of Scope).

### Naming Convention

- `device_type`: `milesight_<model>` where model is the directory name lowercased with hyphens replaced by underscores (e.g., `em300-th` → `milesight_em300_th`)
- `name` (human-readable): `"Milesight <MODEL>"` where MODEL is the uppercased directory name with hyphens preserved (e.g., `em300-th` → `"Milesight EM300-TH"`)
- File name: `types/milesight_<model>.json`

### Categories

All devices receive uniform categories: `["LoRaWAN", "Sensor"]`.

### Description

Template: `"Milesight <MODEL> LoRaWAN Sensor"` (e.g., `"Milesight EM300-TH LoRaWAN Sensor"`).

### Commands

Fields with `access_mode: "W"` are grouped into a single command:

```json
{
  "name": "configure",
  "display_name": "Configure",
  "description": "Configure device parameters",
  "payload_template": "{}",
  "parameters": [
    {
      "name": "<field_id>",
      "display_name": "<field_name>",
      "data_type": "<mapped_type>",
      "required": false
    }
  ]
}
```

If no `access_mode: "W"` fields exist, `commands` remains `[]`.

### index.json Entry

Each converted device adds an entry to `types/index.json`:

```json
{
  "device_type": "milesight_em300_th",
  "name": "Milesight EM300-TH",
  "description": "Milesight EM300-TH LoRaWAN Sensor",
  "categories": ["LoRaWAN", "Sensor"],
  "version": "1.0.0",
  "author": "Milesight",
  "homepage": "https://github.com/Milesight-IoT/SensorDecoders/tree/main/em-series/em300-th"
}
```

The `homepage` URL points to the source directory in the Milesight repo. The script preserves existing entries (e.g., CamThink devices) and only adds/updates Milesight entries. Re-runs are idempotent: existing milesight entries are replaced, non-milesight entries are preserved.

### Script Structure

```
scripts/convert-milesight.js    # Single-file Node.js script
```

### Execution Flow

1. Use `gh api repos/Milesight-IoT/SensorDecoders/contents` to enumerate series directories (filter for `*-series` pattern)
2. For each series, `gh api repos/Milesight-IoT/SensorDecoders/contents/<series-dir>` to enumerate device subdirectories
3. For each device, list files and find the `*-codec.json` file
4. Fetch and parse the codec.json via `gh api`
5. Parse the `object` array, apply field mapping rules (access_mode routing, data_type conversion, unit handling, enum description)
6. Generate NeoMind DeviceType JSON with full command structure
7. Write to `types/milesight_<model>.json`
8. After all devices processed, regenerate `types/index.json` (preserving non-milesight entries)

### Error Handling

- **Device with no codec.json**: skip and log warning
- **Malformed codec.json**: skip device and log error with details
- **Unrecognized data_type/value_type**: map to "String" as fallback, log warning
- **GitHub API rate limit**: stop with error message suggesting `gh auth` refresh
- **Individual field parse failure**: skip field, log warning, continue with remaining fields

### CLI Usage

```bash
node scripts/convert-milesight.js           # Convert all devices
node scripts/convert-milesight.js em300-th  # Convert specific device only
```

### Dependencies

- Node.js (>= 18, for built-in fetch)
- `gh` CLI (authenticated, for GitHub API access)
- No npm packages required

### Out of Scope

- decoder.js code (binary decoding logic) is NOT included
- uplink_samples are NOT populated
- Custom per-series category mapping is NOT implemented
- `reference` grouping fields are NOT converted
- No validation of converted files against a formal schema

### Success Criteria

- All ~126 Milesight devices successfully converted to NeoMind DeviceType JSON files
- Each output file is valid JSON with correct metrics/commands structure
- `index.json` updated with all new device type entries (preserving existing CamThink entries)
- Script is re-runnable (idempotent) without duplicating entries
