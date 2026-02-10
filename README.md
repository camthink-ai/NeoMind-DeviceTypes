# NeoMind Device Types - CamThink Cameras

> CamThink camera device type definitions for NeoMind Platform

## Overview

This repository contains device type definitions for CamThink cameras to be used with the NeoMind platform. Each device type is defined in a JSON file specifying the **metrics** and **commands** that NeoMind uses to identify and process device data.

## Supported Devices

| Device Type | Model | Description | Categories |
|-------------|-------|-------------|------------|
| `ne301_camera` | NE301 | CamThink Edge AI Camera with YOLOv8 object detection | Camera, AI, Edge Computing |
| `ne101_camera` | NE101 | CamThink Sensing Camera with low-power battery and button-triggered capture | Camera, Sensing |

## Usage

### Import Device Types in NeoMind

1. Open NeoMind application
2. Go to **Devices** page, switch to **Device Types** tab
3. Click **"Import from Cloud"** button
4. Select CamThink camera device types
5. Click **"Import"** to complete

---

## Writing Device Type Definitions

### File Structure

Create a JSON file in the `types/` directory with the following structure:

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

### Root Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `device_type` | string | Yes | Unique identifier (use lowercase, underscores) |
| `name` | string | Yes | Human-readable display name |
| `description` | string | No | Detailed description of the device |
| `categories` | array | No | Category tags for grouping (e.g., "Camera", "Sensor") |
| `mode` | string | No | `"simple"` or `"full"` (default: `"simple"`) |
| `metrics` | array | Yes | List of device metrics (data the device provides) |
| `uplink_samples` | array | No | Sample data for AI understanding |
| `commands` | array | No | List of commands (actions the device accepts) |

### Metrics Definition

Each metric represents a piece of data the device reports:

```json
{
  "name": "temperature",
  "display_name": "Temperature",
  "data_type": "float",
  "unit": "°C",
  "min": -40,
  "max": 80,
  "required": true
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Field identifier (matches device data) |
| `display_name` | string | Yes | Human-readable label |
| `data_type` | string | Yes | One of: `string`, `integer`, `float`, `boolean`, `array` |
| `unit` | string | No | Unit of measurement (e.g., "°C", "%", "ms") |
| `min` | number | No | Minimum value (for numeric types) |
| `max` | number | No | Maximum value (for numeric types) |
| `default_value` | any | No | Default value |
| `required` | boolean | No | Whether this metric is required |

**Supported Data Types:**
- `string` - Text data
- `integer` - Whole numbers
- `float` - Decimal numbers
- `boolean` - true/false
- `array` - List of values
- `object` - Nested data structure

### Commands Definition

Each command represents an action the device can accept:

```json
{
  "name": "capture",
  "display_name": "Capture Image",
  "payload_template": "{\"cmd\": \"{{cmd}}\", \"params\": {\"enable\": {{enable}}}}",
  "parameters": [
    {
      "name": "enable",
      "display_name": "Enable",
      "data_type": "boolean",
      "default_value": true,
      "required": true
    }
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Command identifier |
| `display_name` | string | Yes | Human-readable label |
| `payload_template` | string | Yes | Command template with `{{variable}}` placeholders |
| `parameters` | array | No | List of command parameters |

**Parameter Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Parameter identifier |
| `display_name` | string | Yes | Human-readable label |
| `data_type` | string | Yes | Data type of the parameter |
| `default_value` | any | No | Default value |
| `min` / `max` | number | No | Value constraints |
| `unit` | string | No | Unit display |
| `required` | boolean | No | Whether parameter is required |

### Uplink Samples

Provide sample data to help AI understand the device's data format:

```json
"uplink_samples": [
  {
    "timestamp": 1738000000,
    "temperature": 25.6,
    "humidity": 65.2,
    "battery": 85
  },
  {
    "timestamp": 1738000060,
    "temperature": 26.1,
    "humidity": 63.8
  }
]
```

### Naming Conventions

- **Device Type ID**: Use lowercase with underscores (e.g., `ne301_camera`)
- **Metric Names**: Use snake_case matching the device's data structure
- **Display Names**: Use Title Case with spaces
- **Categories**: Use PascalCase for consistency (e.g., "Edge Computing", "AI")

### Complete Example

```json
{
  "device_type": "example_sensor",
  "name": "Example Temperature Sensor",
  "description": "A temperature and humidity sensor for demonstration",
  "categories": ["Sensor", "Environmental"],
  "mode": "simple",
  "metrics": [
    {
      "name": "temperature",
      "display_name": "Temperature",
      "data_type": "float",
      "unit": "°C",
      "min": -40,
      "max": 100,
      "required": true
    },
    {
      "name": "humidity",
      "display_name": "Humidity",
      "data_type": "integer",
      "unit": "%",
      "min": 0,
      "max": 100,
      "required": true
    }
  ],
  "uplink_samples": [
    {
      "temperature": 23.5,
      "humidity": 65
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

---

## NE301 Edge AI Camera

**Features**:
- Built-in YOLOv8 Nano object detection model
- Supports COCO 80-class object recognition
- WiFi connectivity, battery powered
- On-device AI inference, ~50ms inference time

**Supported Commands**:
- `capture` - Capture image and run AI detection
- `sleep` - Enter sleep mode

**Key Metrics**:
- Image metadata (ID, timestamp, dimensions, format)
- Device info (name, MAC, serial number, version)
- Battery status (percentage)
- AI results (detection count, confidence, coordinates)

## NE101 Sensing Camera

**Features**:
- Low-power design
- Battery powered
- Button-triggered capture
- Simplified data structure

**Key Metrics**:
- Timestamp
- Device info (name, MAC, serial number, version)
- Battery status (percentage, voltage)
- Capture trigger type
- Image data

## Contributing

We welcome device type definitions from all NeoMind platform users! If you have a device that's not yet covered, you can submit your own definition to share with the community.

### Why Contribute?

- Help other NeoMind users quickly set up their devices
- Build a comprehensive device type library
- Get feedback and improvements from the community

### How to Submit

1. Fork this repository
2. Create a new JSON file in `types/` following the format above
3. Update `index.json` to include your new device type
4. Submit a Pull Request

Your device type will be reviewed and merged if it follows the format guidelines. Once merged, all NeoMind users can import your device type with one click!

## License

MIT License

---

© 2025 CamThink
