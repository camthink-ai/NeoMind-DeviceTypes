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
  assert.strictEqual(result.description, "EM300-TH LoRaWAN Sensor");
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
      null,
      { id: "battery", name: "Battery", unit: "%", access_mode: "R", data_type: "NUMBER", value_type: "UINT8" },
    ],
  };
  const result = convertCodecToNeoMind("test", "ts-series", codecJson);
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

// --- deviceInfo tests ---

function testDeviceInfoUsedInConversion() {
  const codecJson = {
    version: "1.0.0",
    object: [
      { id: "battery", name: "Battery", unit: "%", access_mode: "R", data_type: "NUMBER", value_type: "UINT8" },
    ],
  };
  const deviceInfo = { id: "em300-th", name: "EM300-TH", description: "Temperature & Humidity Sensor" };
  const result = convertCodecToNeoMind("em300-th", "em-series", codecJson, deviceInfo);
  assert.strictEqual(result.name, "Milesight EM300-TH");
  assert.strictEqual(result.description, "Temperature & Humidity Sensor");
}

function testDeviceInfoInIndexEntry() {
  const deviceInfo = { id: "am307", name: "AM307", description: "Indoor Ambience Monitoring Sensor" };
  const entry = buildIndexEntry("am307", "am-series", deviceInfo);
  assert.strictEqual(entry.name, "Milesight AM307");
  assert.strictEqual(entry.description, "Indoor Ambience Monitoring Sensor");
}

function testDeviceInfoNullFallback() {
  const codecJson = { version: "1.0.0", object: [] };
  const result = convertCodecToNeoMind("em300-th", "em-series", codecJson, null);
  assert.strictEqual(result.name, "Milesight EM300-TH");
  assert.strictEqual(result.description, "EM300-TH LoRaWAN Sensor");
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
  testDeviceInfoUsedInConversion, testDeviceInfoInIndexEntry, testDeviceInfoNullFallback,
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
