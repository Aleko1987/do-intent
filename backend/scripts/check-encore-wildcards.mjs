import { readFile } from "fs/promises";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const targetPath = resolve(scriptDir, "..", "frontend", "encore.service.ts");

const contents = await readFile(targetPath, "utf8");
const lines = contents.split("\n");

const unnamedWildcardPattern = /\/app\/\*(?![A-Za-z0-9_])/g;
const namedWildcardPattern = /\/app\/\*([A-Za-z0-9_]+)/g;

const errors = [];

for (const match of contents.matchAll(unnamedWildcardPattern)) {
  const index = match.index ?? 0;
  const lineNumber = contents.slice(0, index).split("\n").length;
  const lineText = lines[lineNumber - 1] ?? "";
  errors.push(
    `Unnamed wildcard "/app/*" detected at ${targetPath}:${lineNumber}\n` +
      `> ${lineText}`
  );
}

for (const match of contents.matchAll(namedWildcardPattern)) {
  const wildcardName = match[1];
  if (wildcardName !== "path") {
    const index = match.index ?? 0;
    const lineNumber = contents.slice(0, index).split("\n").length;
    const lineText = lines[lineNumber - 1] ?? "";
    errors.push(
      `Unexpected wildcard name "${wildcardName}" in "/app/*${wildcardName}" at ` +
        `${targetPath}:${lineNumber}\n> ${lineText}`
    );
  }
}

if (errors.length > 0) {
  console.error("[guard] Invalid Encore wildcard route configuration:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("[guard] Encore wildcard route check passed.");
