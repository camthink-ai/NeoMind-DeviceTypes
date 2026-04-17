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
      if (!field || !field.id) continue;
      if (field.access_mode === "W") {
        commandParams.push(buildCommandParameter(field));
      } else {
        // "R" and "RW" both go to metrics
        metrics.push(buildMetric(field));
      }
    } catch (e) {
      console.warn(`    Skipping field "${field && field.id}": ${e.message}`);
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

// Export for testing
module.exports = { mapDataType, buildMetric, buildCommandParameter, convertCodecToNeoMind, buildIndexEntry };

// Run main only when executed directly (not when required for testing)
if (require.main === module) {
  main();
}
