import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Run with: npm --prefix tools/catalog run update
const catalogDir = fileURLToPath(new URL("catalog/", import.meta.url));
const pluginPath = new URL("../BotRandomizer.cs", import.meta.url);
const npmPath = process.env.npm_execpath;
if (!npmPath) throw new Error("Run: npm --prefix tools/catalog run update");
const npm = (...args) => execFileSync(process.execPath, [npmPath, ...args], {
  cwd: catalogDir, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"],
});

// Sync the two functions used here; keep the author's inline C# signatures.
const signatureUrl = "https://raw.githubusercontent.com/ianlucas/cs2-css-inventory-simulator/main/gamedata/inventory-simulator.json";
const response = await fetch(signatureUrl, { signal: AbortSignal.timeout(30_000) });
if (!response.ok) throw new Error(`Signature download failed: HTTP ${response.status}`);
const gamedata = await response.json();
let plugin = readFileSync(pluginPath, "utf8");
for (const [marker, name] of [
  ["SetOrAddAttributeValueByName", "CAttributeList::SetOrAddAttributeValueByName"],
  ["CEconItemViewConstructor", "CEconItemView::CEconItemView"],
]) {
  const signatures = gamedata[name]?.signatures;
  if (signatures?.library !== "server") throw new Error(`Missing server signatures: ${name}`);
  const values = ["linux", "windows"].map(platform => {
    const value = signatures[platform];
    if (typeof value !== "string" || !/^(?:[\da-f]{2}|\?{1,2})(?: (?:[\da-f]{2}|\?{1,2})){3,}$/i.test(value)
        || !/[\da-f]{2}/i.test(value)) {
      throw new Error(`Invalid ${platform} signature: ${name}`);
    }
    return value.toUpperCase().replace(/\?\?/g, "?");
  });
  const pattern = new RegExp(
    `(// ${marker}\\r?\\n\\s*\\w+ = new MemoryFunctionWithReturn<[^;]+?` +
    `RuntimeInformation\\.IsOSPlatform\\(OSPlatform\\.Linux\\)\\s*\\? ")[^"]+` +
    `("\\s*:\\s*")[^"]+("\\);)`, "g");
  if ([...plugin.matchAll(pattern)].length !== 1) {
    throw new Error(`Expected exactly one inline signature block for ${marker}; source was not changed`);
  }
  plugin = plugin.replace(pattern, (_, prefix, middle, suffix) =>
    `${prefix}${values[0]}${middle}${values[1]}${suffix}`);
}

const metadata = JSON.parse(npm("view", "@ianlucas/cs2-lib@latest", "version", "gitHead", "--json"));
if (!/^\d+\.\d+\.\d+$/.test(metadata.version) || !/^[a-f0-9]{40}$/.test(metadata.gitHead)) {
  throw new Error("Expected a stable cs2-lib release with a source commit");
}
console.log(npm("install", "--save-exact", "--ignore-scripts", "--no-audit", "--no-fund",
  `@ianlucas/cs2-lib@${metadata.version}`));
const sourcePath = new URL("catalog/source.json", import.meta.url);
const sourceNewline = readFileSync(sourcePath, "utf8").includes("\r\n") ? "\r\n" : "\n";
writeFileSync(sourcePath, (JSON.stringify({
  package: "@ianlucas/cs2-lib", version: metadata.version, commit: metadata.gitHead,
}, null, 2) + "\n").replace(/\n/g, sourceNewline));
console.log(npm("run", "generate"));
// Do not change plugin source if either upstream download or catalog generation fails.
writeFileSync(pluginPath, plugin);
console.log(`Updated inline signatures from ${signatureUrl} and catalog from cs2-lib ${metadata.version}.`);
