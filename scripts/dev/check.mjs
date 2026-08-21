import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const moduleRoot = fileURLToPath(new URL("../../", import.meta.url));

for (const relativePath of ["module.json", "lang/en.json", "lang/ru.json", "package.json"]) {
  JSON.parse(readFileSync(join(moduleRoot, relativePath), "utf8"));
}

function findJavaScriptFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return findJavaScriptFiles(path);
    return extname(entry.name) === ".js" ? [path] : [];
  });
}

for (const path of findJavaScriptFiles(join(moduleRoot, "scripts"))) {
  execFileSync(process.execPath, ["--check", path], { stdio: "inherit" });
}

const en = JSON.parse(readFileSync(join(moduleRoot, "lang/en.json"), "utf8"));
const ru = JSON.parse(readFileSync(join(moduleRoot, "lang/ru.json"), "utf8"));

function leafKeys(value, prefix = "") {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return child && typeof child === "object" && !Array.isArray(child)
      ? leafKeys(child, path)
      : [path];
  });
}

const enKeys = leafKeys(en).sort();
const ruKeys = leafKeys(ru).sort();
if (JSON.stringify(enKeys) !== JSON.stringify(ruKeys)) {
  throw new Error("English and Russian localization keys do not match.");
}

console.log(`Validated 4 JSON files, ${findJavaScriptFiles(join(moduleRoot, "scripts")).length} JavaScript files, and localization key parity.`);
