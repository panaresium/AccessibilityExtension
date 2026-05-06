const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const projectRoot = path.resolve(__dirname, "..");
const ignoredDirectories = new Set([".git", "node_modules"]);
const ignoredPathParts = [
  `${path.sep}tests${path.sep}screenshots${path.sep}`
];
const jsFiles = [];
const jsonFiles = [];
const htmlFiles = [];
const failures = [];

function shouldSkipPath(filePath) {
  return ignoredPathParts.some((part) => filePath.includes(part));
}

function toRelativePath(filePath) {
  return path.relative(projectRoot, filePath).replace(/\\/g, "/");
}

function getLineNumber(text, index) {
  return text.slice(0, index).split(/\r?\n/).length;
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

    if (entry.name.endsWith(".html")) {
      htmlFiles.push(fullPath);
    }
  });
}

function checkJavaScriptSyntax(filePath) {
  const result = spawnSync(process.execPath, ["--check", filePath], {
    encoding: "utf8"
  });

  if (result.status !== 0) {
    failures.push({
      file: toRelativePath(filePath),
      type: "javascript",
      message: (result.stderr || result.stdout || "node --check failed").trim()
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

function checkHtmlStructure(filePath) {
  const html = fs.readFileSync(filePath, "utf8");
  const relativePath = toRelativePath(filePath);
  const ids = new Map();
  const idPattern = /\bid=(["'])([^"']+)\1/gi;
  const buttonPattern = /<button\b([^>]*)>/gi;
  let match;

  while ((match = idPattern.exec(html)) !== null) {
    const id = match[2];
    if (!ids.has(id)) {
      ids.set(id, []);
    }
    ids.get(id).push(getLineNumber(html, match.index));
  }

  ids.forEach((lines, id) => {
    if (lines.length > 1) {
      failures.push({
        file: relativePath,
        type: "html",
        message: `Duplicate id "${id}" appears on lines ${lines.join(", ")}.`
      });
    }
  });

  while ((match = buttonPattern.exec(html)) !== null) {
    if (!/\btype\s*=/i.test(match[1])) {
      failures.push({
        file: relativePath,
        type: "html",
        message: `Button on line ${getLineNumber(html, match.index)} is missing an explicit type attribute.`
      });
    }
  }
}

walkDirectory(projectRoot);
jsFiles.sort().forEach(checkJavaScriptSyntax);
jsonFiles.sort().forEach(checkJsonSyntax);
htmlFiles.sort().forEach(checkHtmlStructure);

if (failures.length) {
  console.error("Static checks failed:");
  failures.forEach((failure) => {
    console.error(`- ${failure.file} (${failure.type}): ${failure.message}`);
  });
  process.exit(1);
}

console.log(`Static checks passed: ${jsFiles.length} JavaScript files, ${jsonFiles.length} JSON files, and ${htmlFiles.length} HTML files.`);
