# NeoMind DeviceTypes

> Device type definitions for [NeoMind](https://github.com/camthink-ai) IoT Platform

## Overview

This repository contains device type definitions for the NeoMind platform. Each device type is defined as a JSON file specifying the **metrics** (data the device provides) and **commands** (actions the device accepts) that NeoMind uses to identify and process device data.

## Supported Devices

| Device Type | Model | Description | Categories |
|-------------|-------|-------------|------------|
| `ne302_camera` | NE302 | Edge AI Camera with YOLOv8 object detection | Camera, AI, Edge Computing |
| `ne301_camera` | NE301 | Edge AI Camera with YOLOv8 object detection | Camera, AI, Edge Computing |
| `ne101_camera` | NE101 | Sensing Camera with low-power battery support | Camera, Sensing |

## Usage

### Import Device Types in NeoMind

1. Open NeoMind application
2. Go to **Devices** page, switch to **Device Types** tab
3. Click **"Import from Cloud"** button
4. Select device types to import
5. Click **"Import"** to complete

## Device Type Definition Format

Each device type is defined in a JSON file under `types/` directory:

```json
{
  "device_type": "unique_device_id",
  "name": "Display Name",
  "description": "Human-readable description",
  "categories": ["Category1", "Category2"],
  "mode": "simple",
  "metrics": [...],
  "uplink_samples": [...],
  "commands": [...]
}
```

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `device_type` | string | ✅ | Unique identifier (lowercase with underscores) |
| `name` | string | ✅ | Human-readable display name |
| `description` | string | ❌ | Detailed description |
| `categories` | array | ❌ | Category tags for grouping |
| `mode` | string | ❌ | `"simple"` or `"full"` (default: `"simple"`) |
| `store_raw` | boolean | ❌ | If `false`, skip storing the `_raw` metric (full payload snapshot) for this device type. Default `true`. Set `false` for large-payload devices (e.g. cameras) whose structured `metrics` already cover all fields. Requires NeoMind ≥ 0.9.7; ignored by earlier versions. |
| `metrics` | array | ✅ | Device metrics (data the device provides) |
| `uplink_samples` | array | ❌ | Sample data for AI understanding |
| `commands` | array | ❌ | Device commands (actions the device accepts) |

### Data Types

| Type | Description |
|------|-------------|
| `String` | Text data |
| `Integer` | Whole numbers |
| `Float` | Decimal numbers |
| `Boolean` | true/false |
| `Array` | List of values |

> Both TitleCase (`"Integer"`) and lowercase (`"integer"`) are accepted on read. NeoMind serializes them as lowercase internally — do not rely on case in downstream logic.

## Commands

A command maps a user action to a downstream JSON payload sent to the device. The renderer is **JSON-aware** (it parses the template, walks the tree, substitutes placeholders, and re-serializes) — not a naive string replacer. Declare what the device expects on the wire, nothing more.

### Command fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | ✅ | Unique command id (snake_case) |
| `display_name` | string | ✅ | Label shown in the UI |
| `description` | string | ❌ | Human-readable description |
| `payload_template` | string | ✅ | JSON template with `${var}` placeholders |
| `parameters` | array | ❌ | User-facing inputs (see below) |
| `fixed_values` | object | ❌ | Constant JSON values merged into every render |

### `payload_template` syntax

- Plain JSON, with `${name}` placeholders substituted at render time.
- Inside a JSON string: `"${name}"` → substitutes the value, keeps quotes only for string values.
- Outside a JSON string (bare): `${name}` → substitutes the raw JSON token (numbers/booleans/objects/arrays keep their type).
- Unknown placeholders are left as-is (rendering does not fail).

```json
{"cmd": "sleep", "request_id": "${request_id}", "params": {"duration_sec": ${duration_sec}}}
```

### Three parameter categories — do not mix them up

| Category | Where declared | Who supplies the value | Example |
|----------|----------------|------------------------|---------|
| **User-facing** | `parameters` array | End user via UI form | `duration_sec` for sleep |
| **Fixed constant** | `fixed_values` object | Template author | `enable_ai: true` (always on) |
| **System-auto** | neither | NeoMind at render time | `request_id` |

### `${request_id}` is auto-injected — never declare it

When a template references `${request_id}` but no value is supplied, NeoMind mints `req-<uuid>` automatically. **Do NOT add `request_id` to `parameters`** — it is not a user input, exposing it only confuses end users.

```json
// ✅ Correct — request_id invisible to the user
{
  "name": "capture",
  "display_name": "Capture",
  "payload_template": "{\"cmd\": \"capture\", \"request_id\": \"${request_id}\"}",
  "parameters": []
}

// ❌ Wrong — exposes an internal system field to the UI
{
  "name": "capture",
  "parameters": [{"name": "request_id", "display_name": "Request ID", ...}]
}
```

### Zero-parameter commands are valid

If a command has no user-tunable inputs, leave `parameters: []` and embed all constants directly in `payload_template`. The NE301 `capture` command is the canonical example — the device protocol is simply `{"cmd": "capture", "request_id": "..."}`.

### Pitfalls to avoid

- **Do not fabricate fields the device protocol does not accept.** Every key in `payload_template` MUST exist in the real wire format. Earlier NE301 templates invented `enable_ai` / `chunk_size` / `store_to_sd` — the device silently ignored them.
- **Do not hoist system-internal fields into `parameters`.** `request_id`, chunking offsets, and similar orchestration metadata belong to NeoMind, not to the user.
- **Do not double-brace placeholders.** Use `${name}`, never `${{name}}` or `${{value}}`. The renderer treats doubled braces as literal text.
- **Do not rely on key ordering.** The renderer re-serializes via `serde_json`; emit/receive code must parse JSON, not pattern-match on byte offsets.

## File Structure

```
types/
├── ne302_camera.json
├── ne301_camera.json
├── ne101_camera.json
└── {device_type}.json
```

## Adding New Device Types

1. Create a new JSON file in `types/` directory
2. Follow the format specified above
3. Submit a Pull Request

No need to update any index file - NeoMind automatically discovers device types from the `types/` directory.

## Example

```json
{
  "device_type": "example_sensor",
  "name": "Example Temperature Sensor",
  "description": "A temperature and humidity sensor",
  "categories": ["Sensor", "Environmental"],
  "mode": "simple",
  "metrics": [
    {
      "name": "temperature",
      "display_name": "Temperature",
      "data_type": "Float",
      "unit": "°C",
      "min": -40,
      "max": 100
    }
  ],
  "uplink_samples": [
    {
      "temperature": 23.5
    }
  ],
  "commands": [
    {
      "name": "calibrate",
      "display_name": "Calibrate",
      "payload_template": "{\"action\": \"calibrate\"}",
      "parameters": []
    },
    {
      "name": "set_threshold",
      "display_name": "Set Threshold",
      "description": "Configure the alert threshold",
      "payload_template": "{\"action\": \"set_threshold\", \"request_id\": \"${request_id}\", \"params\": {\"threshold\": ${threshold}}}",
      "parameters": [
        {
          "name": "threshold",
          "display_name": "Threshold",
          "data_type": "Float",
          "unit": "°C",
          "min": -40,
          "max": 100,
          "required": true
        }
      ]
    }
  ]
}
```

The `calibrate` command is zero-parameter (constants baked into the template). The `set_threshold` command declares `threshold` as the only user-facing parameter — `request_id` is referenced in the template but **not** declared in `parameters`, since NeoMind auto-injects it.

## License

MIT License

## Links

- [NeoMind Platform](https://github.com/camthink-ai/NeoMind)
