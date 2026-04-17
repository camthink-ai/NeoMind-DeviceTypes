# Milesight SensorDecoders to NeoMind DeviceTypes Converter

## Problem

The [Milesight-IoT/SensorDecoders](https://github.com/Milesight-IoT/SensorDecoders) repository contains ~126 LoRaWAN sensor decoder definitions across 14 device series. We need to convert these into NeoMind DeviceType JSON format so the NeoMind platform can recognize and display Milesight devices.

## Decision

Write a Node.js conversion script that pulls `*-codec.json` files from GitHub via `gh api`, transforms each into a NeoMind DeviceType JSON file, and updates the central `index.json` registry.

## Design

### Input: Milesight codec.json Structure

Each device directory (e.g., `em-series/em300-th/`) contains a `*-codec.json` file with an `object` array defining all data fields:

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
    }
  ]
}
```

Key fields per entry:
- `id` — field identifier (may use dot notation for nested objects)
- `name` — human-readable display name
- `unit` — measurement unit
- `access_mode` — "R" (read), "W" (write), "RW" (read-write)
- `data_type` — "NUMBER", "TEXT", "BOOL", "ENUM"
- `value_type` — "UINT8", "UINT16", "INT16", "FLOAT", "STRING", etc.
- `values` — (optional) enum value map for ENUM types

### Output: NeoMind DeviceType JSON

Target format matching existing files (`ne101_camera.json`, `ne301_camera.json`):

```json
{
  "device_type": "milesight_em300_th",
  "name": "Milesight EM300-TH Temperature & Humidity Sensor",
  "description": "LoRaWAN temperature and humidity sensor",
  "categories": ["LoRaWAN", "Sensor"],
  "mode": "simple",
  "metrics": [...],
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
| NUMBER | UINT8/UINT16/UINT32/INT8/INT16 | "Integer" |
| TEXT | STRING | "String" |
| BOOL | UINT8 | "Boolean" |
| ENUM | UINT8 | "String" (enum values noted in description) |

### Naming Convention

- `device_type`: `milesight_<model>` where model is the directory name lowercased with hyphens replaced by underscores (e.g., `em300-th` → `milesight_em300_th`)
- File name: `types/milesight_<model>.json`

### Categories

All devices receive uniform categories: `["LoRaWAN", "Sensor"]`.

### Description

Generated from device series context: `"LoRaWAN <series description> sensor"` (e.g., "LoRaWAN temperature and humidity sensor" for EM300-TH).

### Commands

Fields with `access_mode: "W"` are grouped into a single "configure" command with all writable parameters.

### Script Structure

```
scripts/convert-milesight.js    # Single-file Node.js script
```

### Execution Flow

1. Use `gh api` to enumerate all series directories in the Milesight repo
2. For each series, enumerate device subdirectories
3. For each device, fetch `*-codec.json` via `gh api`
4. Parse the `object` array, apply field mapping rules
5. Generate NeoMind DeviceType JSON
6. Write to `types/milesight_<model>.json`
7. After all devices processed, regenerate `types/index.json`

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
- No validation of converted files against a formal schema

### Success Criteria

- All ~126 Milesight devices successfully converted to NeoMind DeviceType JSON files
- Each output file is valid JSON with correct metrics/commands structure
- `index.json` updated with all new device type entries
- Script is re-runnable (idempotent) without duplicating entries
