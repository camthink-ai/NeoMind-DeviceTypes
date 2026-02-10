# NeoMind DeviceTypes

> Device type definitions for [NeoMind](https://github.com/camthink-ai) IoT Platform

## Overview

This repository contains device type definitions for the NeoMind platform. Each device type is defined as a JSON file specifying the **metrics** (data the device provides) and **commands** (actions the device accepts) that NeoMind uses to identify and process device data.

## Supported Devices

| Device Type | Model | Description | Categories |
|-------------|-------|-------------|------------|
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

## File Structure

```
types/
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
    }
  ]
}
```

## License

MIT License

## Links

- [NeoMind Platform](https://github.com/camthink-ai/NeoMind)
