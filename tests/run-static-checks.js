const fs = require("fs");
const path = require("path");
const vm = require("vm");

const projectRoot = path.resolve(__dirname, "..");
const ignoredDirectories = new Set([".git", "node_modules"]);
const ignoredPathParts = [
  `${path.sep}tests${path.sep}screenshots${path.sep}`
];
const jsFiles = [];
const jsonFiles = [];
const failures = [];

function shouldSkipPath(filePath) {
  return ignoredPathParts.some((part) => filePath.includes(part));
}

function toRelativePath(filePath) {
  return path.relative(projectRoot, filePath).replace(/\\/g, "/");
}

function walkDirectory(directory) {
  fs.readdirSync(directory, { withFileTypes: true }).forEach((entry) => {
    const fullPath = path.join(directory, entry.name);

    if (shouldSkipPath(fullPath)) {
      return;
    }

    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) {
        walkDirectory(fullPath);
      }
      return;
    }

    if (!entry.isFile()) {
      return;
    }

    if (entry.name.endsWith(".js")) {
      jsFiles.push(fullPath);
      return;
    }

    if (entry.name.endsWith(".json")) {
      jsonFiles.push(fullPath);
    }
  });
}

function checkJavaScriptSyntax(filePath) {
  try {
    new vm.Script(fs.readFileSync(filePath, "utf8"), {
      filename: filePath
    });
  } catch (error) {
    failures.push({
      file: toRelativePath(filePath),
      type: "javascript",
      message: error.message
    });
  }
}

function checkJsonSyntax(filePath) {
  try {
    JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    failures.push({
      file: toRelativePath(filePath),
      type: "json",
      message: error.message
    });
  }
}

walkDirectory(projectRoot);
jsFiles.sort().forEach(checkJavaScriptSyntax);
jsonFiles.sort().forEach(checkJsonSyntax);

if (failures.length) {
  console.error("Static checks failed:");
  failures.forEach((failure) => {
    console.error(`- ${failure.file} (${failure.type}): ${failure.message}`);
  });
  process.exit(1);
}

console.log(`Static checks passed: ${jsFiles.length} JavaScript files and ${jsonFiles.length} JSON files.`);
