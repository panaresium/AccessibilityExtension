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
const cssFiles = [];
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
      return;
    }

    if (entry.name.endsWith(".css")) {
      cssFiles.push(fullPath);
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

function getLocation(source, index) {
  const before = source.slice(0, index);
  const line = before.split("\n").length;
  const column = before.length - before.lastIndexOf("\n");
  return `${line}:${column}`;
}

function checkCssSyntax(filePath) {
  const source = fs.readFileSync(filePath, "utf8");
  let blockDepth = 0;
  let quote = null;
  let inComment = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const nextCharacter = source[index + 1];

    if (inComment) {
      if (character === "*" && nextCharacter === "/") {
        inComment = false;
        index += 1;
      }
      continue;
    }

    if (quote) {
      if (character === "\\") {
        index += 1;
        continue;
      }

      if (character === quote) {
        quote = null;
      }
      continue;
    }

    if (character === "/" && nextCharacter === "*") {
      inComment = true;
      index += 1;
      continue;
    }

    if (character === "\"" || character === "'") {
      quote = character;
      continue;
    }

    if (character === "{") {
      blockDepth += 1;
      continue;
    }

    if (character === "}") {
      blockDepth -= 1;
      if (blockDepth < 0) {
        failures.push({
          file: toRelativePath(filePath),
          type: "css",
          message: `Unexpected closing brace at ${getLocation(source, index)}`
        });
        return;
      }
    }
  }

  if (inComment) {
    failures.push({
      file: toRelativePath(filePath),
      type: "css",
      message: "Unclosed CSS comment"
    });
    return;
  }

  if (quote) {
    failures.push({
      file: toRelativePath(filePath),
      type: "css",
      message: "Unclosed CSS string"
    });
    return;
  }

  if (blockDepth !== 0) {
    failures.push({
      file: toRelativePath(filePath),
      type: "css",
      message: "Unclosed CSS block"
    });
  }
}

walkDirectory(projectRoot);
jsFiles.sort().forEach(checkJavaScriptSyntax);
jsonFiles.sort().forEach(checkJsonSyntax);
cssFiles.sort().forEach(checkCssSyntax);

if (failures.length) {
  console.error("Static checks failed:");
  failures.forEach((failure) => {
    console.error(`- ${failure.file} (${failure.type}): ${failure.message}`);
  });
  process.exit(1);
}

console.log(`Static checks passed: ${jsFiles.length} JavaScript files, ${jsonFiles.length} JSON files, and ${cssFiles.length} CSS files.`);
