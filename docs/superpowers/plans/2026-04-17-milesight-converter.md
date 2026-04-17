# Milesight Converter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Node.js script that batch-converts ~126 Milesight LoRaWAN sensor codec.json files into NeoMind DeviceType JSON format.

**Architecture:** Single-file Node.js script (`scripts/convert-milesight.js`) with no npm dependencies. Uses `gh api` CLI for GitHub API access. Core transformation logic is pure functions that map Milesight codec fields to NeoMind metrics/commands. A test file validates the mapping functions.

**Tech Stack:** Node.js >= 18, `gh` CLI, JSON processing

**Spec:** `docs/superpowers/specs/2026-04-17-milesight-converter-design.md`

---

## File Structure

| File | Responsibility |
|---|---|
| `scripts/convert-milesight.js` | Main script: GitHub API calls, transformation, file output |
| `scripts/__tests__/convert-milesight.test.js` | Unit tests for pure mapping functions |

---

### Task 1: Scaffold script and test infrastructure

**Files:**
- Create: `scripts/convert-milesight.js`
- Create: `scripts/__tests__/convert-milesight.test.js`

- [ ] **Step 0: Create directories and verify prerequisites**

```bash
mkdir -p scripts/__tests__
node --version  # verify >= 18
gh auth status  # verify authenticated
```

- [ ] **Step 1: Create the script scaffold**

Create `scripts/convert-milesight.js` with the basic structure:

```javascript
#!/usr/bin/env node

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// --- Pure mapping functions (exported for testing) ---

function mapDataType(milesightDataType, milesightValueType) {
  if (milesightDataType === "TEXT") return "String";
  if (milesightDataType === "BOOL") return "Boolean";
  if (milesightDataType === "ENUM") return "String";
  if (milesightDataType === "NUMBER") {
    if (milesightValueType === "FLOAT") return "Float";
    return "Integer";
  }
  console.warn(`  Unknown data_type "${milesightDataType}/${milesightValueType}", falling back to String`);
  return "String"; // fallback
}

function buildMetric(field) {
  const metric = {
    name: field.id,
    display_name: field.name,
    data_type: mapDataType(field.data_type, field.value_type),
    required: false,
  };
  if (field.unit && field.unit !== "") {
    metric.unit = field.unit;
  }
  // Append enum options to display_name
  if (field.data_type === "ENUM" && field.values && field.values.length > 0) {
    const opts = field.values.map((v) => `${v.value}=${v.name}`).join(", ");
    metric.display_name += ` (Options: ${opts})`;
  }
  return metric;
}

function buildCommandParameter(field) {
  const param = {
    name: field.id,
    display_name: field.name,
    data_type: mapDataType(field.data_type, field.value_type),
    required: false,
  };
  if (field.unit && field.unit !== "") {
    param.unit = field.unit;
  }
  return param;
}

function convertCodecToNeoMind(modelName, seriesDir, codecJson) {
  const fields = codecJson.object || [];
  const metrics = [];
  const commandParams = [];

  for (const field of fields) {
    try {
      if (field.access_mode === "W") {
        commandParams.push(buildCommandParameter(field));
      } else {
        // "R" and "RW" both go to metrics
        metrics.push(buildMetric(field));
      }
    } catch (e) {
      console.warn(`    Skipping field "${field.id}": ${e.message}`);
    }
  }

  const result = {
    device_type: `milesight_${modelName.toLowerCase().replace(/-/g, "_")}`,
    name: `Milesight ${modelName.toUpperCase()}`,
    description: `Milesight ${modelName.toUpperCase()} LoRaWAN Sensor`,
    categories: ["LoRaWAN", "Sensor"],
    mode: "simple",
    metrics,
    uplink_samples: [],
    commands: [],
  };

  if (commandParams.length > 0) {
    result.commands.push({
      name: "configure",
      display_name: "Configure",
      description: "Configure device parameters",
      payload_template: "{}",
      parameters: commandParams,
    });
  }

  return result;
}

function buildIndexEntry(modelName, seriesDir) {
  return {
    device_type: `milesight_${modelName.toLowerCase().replace(/-/g, "_")}`,
    name: `Milesight ${modelName.toUpperCase()}`,
    description: `Milesight ${modelName.toUpperCase()} LoRaWAN Sensor`,
    categories: ["LoRaWAN", "Sensor"],
    version: "1.0.0",
    author: "Milesight",
    homepage: `https://github.com/Milesight-IoT/SensorDecoders/tree/main/${seriesDir}/${modelName}`,
  };
}

// --- GitHub API helpers ---

function ghApi(endpoint) {
  try {
    const result = execSync(`gh api "${endpoint}"`, {
      encoding: "utf-8",
      maxBuffer: 50 * 1024 * 1024,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return JSON.parse(result);
  } catch (e) {
    const stderr = e.stderr || "";
    if (stderr.includes("403") || stderr.includes("rate limit")) {
      console.error("GitHub API rate limit hit. Try running: gh auth refresh");
    }
    throw e;
  }
}

function findCodecFile(files) {
  return files.find((f) => f.name.endsWith("-codec.json"));
}

// --- Main ---

function main() {
  const filter = process.argv[2] || null;
  const typesDir = path.join(__dirname, "..", "types");

  console.log("Fetching Milesight device series...");
  const rootContents = ghApi("repos/Milesight-IoT/SensorDecoders/contents");
  const seriesDirs = rootContents.filter(
    (item) => item.type === "dir" && item.name.endsWith("-series")
  );

  const allConverted = [];

  for (const series of seriesDirs) {
    console.log(`\nProcessing ${series.name}...`);
    let devices;
    try {
      devices = ghApi(`repos/Milesight-IoT/SensorDecoders/contents/${series.name}`);
    } catch (e) {
      console.warn(`  Failed to list ${series.name}: ${e.message}`);
      continue;
    }

    const deviceDirs = devices.filter((d) => d.type === "dir");

    for (const device of deviceDirs) {
      const modelName = device.name;

      if (filter && modelName !== filter) continue;

      console.log(`  Converting ${modelName}...`);

      let files;
      try {
        files = ghApi(`repos/Milesight-IoT/SensorDecoders/contents/${series.name}/${modelName}`);
      } catch (e) {
        console.warn(`    Failed to list files: ${e.message}`);
        continue;
      }

      const codecFile = findCodecFile(files);
      if (!codecFile) {
        console.warn(`    No codec.json found, skipping`);
        continue;
      }

      let codecJson;
      try {
        const raw = ghApi(`repos/Milesight-IoT/SensorDecoders/contents/${series.name}/${modelName}/${codecFile.name}`);
        const content = Buffer.from(raw.content, "base64").toString("utf-8");
        codecJson = JSON.parse(content);
      } catch (e) {
        console.warn(`    Failed to fetch/parse codec: ${e.message}`);
        continue;
      }

      const neoMindType = convertCodecToNeoMind(modelName, series.name, codecJson);
      const outputPath = path.join(typesDir, `${neoMindType.device_type}.json`);

      fs.writeFileSync(outputPath, JSON.stringify(neoMindType, null, 2) + "\n");
      console.log(`    -> ${outputPath}`);

      allConverted.push({ modelName, seriesDir: series.name, neoMindType });
    }
  }

  // Update index.json
  console.log(`\nUpdating index.json with ${allConverted.length} devices...`);
  const indexPath = path.join(typesDir, "index.json");
  const existingIndex = JSON.parse(fs.readFileSync(indexPath, "utf-8"));

  // Remove old milesight entries, keep others
  const otherEntries = existingIndex.device_types.filter(
    (e) => !e.device_type.startsWith("milesight_")
  );

  const milesightEntries = allConverted.map((c) =>
    buildIndexEntry(c.modelName, c.seriesDir)
  );

  existingIndex.device_types = [...otherEntries, ...milesightEntries];
  existingIndex.last_updated = new Date().toISOString();

  fs.writeFileSync(indexPath, JSON.stringify(existingIndex, null, 2) + "\n");
  console.log("Done!");
}

main();

// Export for testing
if (typeof module !== "undefined") {
  module.exports = { mapDataType, buildMetric, buildCommandParameter, convertCodecToNeoMind, buildIndexEntry };
}
```

- [ ] **Step 2: Create the test file**

Create `scripts/__tests__/convert-milesight.test.js`:

```javascript
const assert = require("assert");
const {
  mapDataType,
  buildMetric,
  buildCommandParameter,
  convertCodecToNeoMind,
  buildIndexEntry,
} = require("../convert-milesight");

// --- mapDataType tests ---

function testNumberFloat() {
  assert.strictEqual(mapDataType("NUMBER", "FLOAT"), "Float");
}

function testNumberUint8() {
  assert.strictEqual(mapDataType("NUMBER", "UINT8"), "Integer");
}

function testNumberUint16() {
  assert.strictEqual(mapDataType("NUMBER", "UINT16"), "Integer");
}

function testNumberInt16() {
  assert.strictEqual(mapDataType("NUMBER", "INT16"), "Integer");
}

function testText() {
  assert.strictEqual(mapDataType("TEXT", "STRING"), "String");
}

function testBool() {
  assert.strictEqual(mapDataType("BOOL", "UINT8"), "Boolean");
}

function testEnum() {
  assert.strictEqual(mapDataType("ENUM", "UINT8"), "String");
}

function testUnknownFallback() {
  assert.strictEqual(mapDataType("WEIRD", "XYZ"), "String");
}

// --- buildMetric tests ---

function testBasicMetric() {
  const field = {
    id: "battery",
    name: "Battery",
    unit: "%",
    access_mode: "R",
    data_type: "NUMBER",
    value_type: "UINT8",
  };
  const metric = buildMetric(field);
  assert.strictEqual(metric.name, "battery");
  assert.strictEqual(metric.display_name, "Battery");
  assert.strictEqual(metric.data_type, "Integer");
  assert.strictEqual(metric.unit, "%");
  assert.strictEqual(metric.required, false);
}

function testMetricOmitsEmptyUnit() {
  const field = {
    id: "reset_event",
    name: "Reset Event",
    unit: "",
    access_mode: "R",
    data_type: "BOOL",
    value_type: "UINT8",
  };
  const metric = buildMetric(field);
  assert.strictEqual(metric.name, "reset_event");
  assert.ok(!("unit" in metric), "unit should be omitted when empty");
}

function testMetricOmitsAbsentUnit() {
  const field = {
    id: "status",
    name: "Status",
    access_mode: "R",
    data_type: "BOOL",
    value_type: "UINT8",
  };
  const metric = buildMetric(field);
  assert.ok(!("unit" in metric), "unit should be omitted when absent");
}

function testEnumMetricWithValues() {
  const field = {
    id: "lorawan_class",
    name: "LoRaWAN Class Type",
    unit: "",
    access_mode: "R",
    data_type: "ENUM",
    value_type: "UINT8",
    values: [
      { value: 0, name: "Class A" },
      { value: 1, name: "Class B" },
      { value: 2, name: "Class C" },
    ],
  };
  const metric = buildMetric(field);
  assert.strictEqual(metric.data_type, "String");
  assert.ok(metric.display_name.includes("Options:"));
  assert.ok(metric.display_name.includes("0=Class A"));
  assert.ok(metric.display_name.includes("2=Class C"));
}

function testBoolWithValuesArrayIgnored() {
  const field = {
    id: "device_status",
    name: "Device Status",
    unit: "",
    access_mode: "R",
    data_type: "BOOL",
    value_type: "UINT8",
    values: [
      { value: 0, name: "off" },
      { value: 1, name: "on" },
    ],
  };
  const metric = buildMetric(field);
  assert.strictEqual(metric.data_type, "Boolean");
  assert.ok(!metric.display_name.includes("Options:"), "BOOL values should not add Options text");
}

function testDotNotationPreserved() {
  const field = {
    id: "temperature_alarm_config.condition",
    name: "Temperature Alarm Config (Condition)",
    unit: "",
    access_mode: "RW",
    data_type: "ENUM",
    value_type: "UINT8",
    values: [
      { value: 0, name: "disable" },
      { value: 1, name: "below" },
    ],
  };
  const metric = buildMetric(field);
  assert.strictEqual(metric.name, "temperature_alarm_config.condition");
}

// --- buildCommandParameter tests ---

function testCommandParameter() {
  const field = {
    id: "report_interval",
    name: "Report Interval",
    unit: "s",
    access_mode: "W",
    data_type: "NUMBER",
    value_type: "UINT16",
  };
  const param = buildCommandParameter(field);
  assert.strictEqual(param.name, "report_interval");
  assert.strictEqual(param.data_type, "Integer");
  assert.strictEqual(param.unit, "s");
}

// --- convertCodecToNeoMind tests ---

function testFullConversion() {
  const codecJson = {
    version: "1.0.0",
    bytes: "0175640367040104687B",
    object: [
      { id: "battery", name: "Battery", unit: "%", access_mode: "R", data_type: "NUMBER", value_type: "UINT8" },
      { id: "temperature", name: "Temperature", unit: "°C", access_mode: "R", data_type: "NUMBER", value_type: "FLOAT" },
      { id: "report_interval", name: "Report Interval", unit: "s", access_mode: "W", data_type: "NUMBER", value_type: "UINT16" },
      { id: "reboot", name: "Reboot", unit: "", access_mode: "W", data_type: "BOOL", value_type: "UINT8" },
    ],
  };

  const result = convertCodecToNeoMind("em300-th", "em-series", codecJson);

  assert.strictEqual(result.device_type, "milesight_em300_th");
  assert.strictEqual(result.name, "Milesight EM300-TH");
  assert.strictEqual(result.description, "Milesight EM300-TH LoRaWAN Sensor");
  assert.deepStrictEqual(result.categories, ["LoRaWAN", "Sensor"]);
  assert.strictEqual(result.mode, "simple");
  assert.strictEqual(result.metrics.length, 2);
  assert.strictEqual(result.uplink_samples.length, 0);
  assert.strictEqual(result.commands.length, 1);
  assert.strictEqual(result.commands[0].name, "configure");
  assert.strictEqual(result.commands[0].parameters.length, 2);
}

function testNoWriteFields() {
  const codecJson = {
    version: "1.0.0",
    object: [
      { id: "temperature", name: "Temperature", unit: "°C", access_mode: "R", data_type: "NUMBER", value_type: "FLOAT" },
    ],
  };

  const result = convertCodecToNeoMind("am102", "am-series", codecJson);
  assert.strictEqual(result.commands.length, 0);
}

function testRWFieldsGoToMetrics() {
  const codecJson = {
    version: "1.0.0",
    object: [
      { id: "report_interval", name: "Report Interval", unit: "s", access_mode: "RW", data_type: "NUMBER", value_type: "UINT16" },
    ],
  };

  const result = convertCodecToNeoMind("em300-th", "em-series", codecJson);
  assert.strictEqual(result.metrics.length, 1);
  assert.strictEqual(result.metrics[0].name, "report_interval");
  assert.strictEqual(result.commands.length, 0);
}

function testEmptyObjectArray() {
  const codecJson = { version: "1.0.0", object: [] };
  const result = convertCodecToNeoMind("test", "ts-series", codecJson);
  assert.strictEqual(result.metrics.length, 0);
  assert.strictEqual(result.commands.length, 0);
}

function testNullObjectField() {
  const codecJson = { version: "1.0.0" };
  const result = convertCodecToNeoMind("test", "ts-series", codecJson);
  assert.strictEqual(result.metrics.length, 0);
}

function testMalformedFieldSkipped() {
  const codecJson = {
    version: "1.0.0",
    object: [
      null, // malformed
      { id: "battery", name: "Battery", unit: "%", access_mode: "R", data_type: "NUMBER", value_type: "UINT8" },
    ],
  };
  const result = convertCodecToNeoMind("test", "ts-series", codecJson);
  // null field is skipped via try/catch, battery is kept
  assert.strictEqual(result.metrics.length, 1);
}

// --- buildIndexEntry tests ---

function testIndexEntry() {
  const entry = buildIndexEntry("em300-th", "em-series");
  assert.strictEqual(entry.device_type, "milesight_em300_th");
  assert.strictEqual(entry.name, "Milesight EM300-TH");
  assert.strictEqual(entry.version, "1.0.0");
  assert.strictEqual(entry.author, "Milesight");
  assert.ok(entry.homepage.includes("em-series/em300-th"));
}

// --- Run all tests ---

const tests = [
  testNumberFloat, testNumberUint8, testNumberUint16, testNumberInt16,
  testText, testBool, testEnum, testUnknownFallback,
  testBasicMetric, testMetricOmitsEmptyUnit, testMetricOmitsAbsentUnit,
  testEnumMetricWithValues, testBoolWithValuesArrayIgnored, testDotNotationPreserved,
  testCommandParameter,
  testFullConversion, testNoWriteFields, testRWFieldsGoToMetrics,
  testEmptyObjectArray, testNullObjectField, testMalformedFieldSkipped,
  testIndexEntry,
];

let passed = 0;
let failed = 0;
for (const test of tests) {
  try {
    test();
    passed++;
    console.log(`  PASS: ${test.name}`);
  } catch (e) {
    failed++;
    console.error(`  FAIL: ${test.name}: ${e.message}`);
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
```

- [ ] **Step 3: Run tests to verify they all pass**

Run: `node scripts/__tests__/convert-milesight.test.js`
Expected: All 22 tests PASS

- [ ] **Step 4: Commit scaffold**

```bash
git add scripts/convert-milesight.js scripts/__tests__/convert-milesight.test.js
git commit -m "feat: add Milesight converter script with mapping tests"
```

---

### Task 2: Run conversion and validate output

**Files:**
- Modify: `types/index.json` (auto-updated by script)
- Create: ~126 `types/milesight_*.json` files (auto-generated)

- [ ] **Step 1: Run the converter for a single device first**

Run: `node scripts/convert-milesight.js em300-th`
Expected: Creates `types/milesight_em300_th.json`, updates `index.json`

- [ ] **Step 2: Verify the single device output**

Read `types/milesight_em300_th.json` and confirm:
- `device_type` is `milesight_em300_th`
- `metrics` contains battery, temperature, humidity etc.
- `commands` contains configure with writable parameters
- `index.json` has the new entry with correct homepage URL

- [ ] **Step 3: Run full conversion for all devices**

Run: `node scripts/convert-milesight.js`
Expected: Processes all 14 series, creates ~126 device type files

- [ ] **Step 4: Validate output count**

Run: `ls types/milesight_*.json | wc -l`
Expected: ~126 files (some devices may lack codec.json)

- [ ] **Step 5: Validate all generated files are valid JSON**

Run: `node -e "const fs=require('fs'),path=require('path'); const files=fs.readdirSync('types').filter(f=>f.startsWith('milesight_')); let bad=0; files.forEach(f=>{try{JSON.parse(fs.readFileSync(path.join('types',f),'utf-8'))}catch(e){console.error('INVALID:',f,e.message);bad++}}); console.log('Checked:',files.length,'Invalid:',bad)"`
Expected: Checked: ~126, Invalid: 0

- [ ] **Step 6: Spot-check a few diverse devices**

Run: `node -e "['am307','ws301','uc11xx','vs330'].forEach(m=>{try{const d=require('./types/milesight_'+m+'.json');console.log(m+':',d.metrics.length,'metrics,',d.commands.length,'commands')}catch(e){console.log(m+': NOT FOUND')}})"`
Expected: Each prints valid metric/command counts

- [ ] **Step 7: Verify index.json integrity**

Run: `node -e "const i=require('./types/index.json'); const ms=i.device_types.filter(d=>d.device_type.startsWith('milesight_')); const other=i.device_types.filter(d=>!d.device_type.startsWith('milesight_')); console.log('total:',i.device_types.length,'milesight:',ms.length,'other:',other.length)"`
Expected: ~126 milesight + 2 CamThink entries

- [ ] **Step 8: Commit all converted device types**

```bash
git add types/
git commit -m "feat: add Milesight LoRaWAN sensor device types (~126 devices)

Converted from Milesight-IoT/SensorDecoders codec.json definitions.
Each device type includes metrics (telemetry) and commands (configuration)."
```

---

### Task 3: Clean up and verify idempotency

**Files:**
- No new files

- [ ] **Step 1: Run converter again to verify idempotency**

Run: `node scripts/convert-milesight.js`
Expected: Same output, no duplicate entries in index.json, no errors

- [ ] **Step 2: Verify index.json has no duplicates**

Run: `node -e "const i=require('./types/index.json'); const ids=i.device_types.map(d=>d.device_type); const dupes=ids.filter((id,idx)=>ids.indexOf(id)!==idx); console.log('duplicates:',dupes.length)"`
Expected: 0 duplicates

- [ ] **Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: ensure converter idempotency" # only if changes needed
```
