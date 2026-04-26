import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

await fs.mkdir(path.join(root, "dist", "renderer"), { recursive: true });
await fs.copyFile(path.join(root, "src", "preload.js"), path.join(root, "dist", "preload.js"));
await fs.copyFile(
  path.join(root, "src", "renderer", "region-overlay.html"),
  path.join(root, "dist", "renderer", "region-overlay.html")
);
