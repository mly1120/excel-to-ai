import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const workspaceRoot = resolve(process.cwd(), "../..");

export const paths = {
  workspaceRoot,
  uploadsDir: resolve(workspaceRoot, "uploads"),
  outputsDir: resolve(workspaceRoot, "outputs"),
  dataDir: resolve(workspaceRoot, "data"),
  parsedDir: resolve(workspaceRoot, "data", "parsed"),
  databaseFile: resolve(workspaceRoot, "data", "excel-to-ai.db")
};

export function ensureWorkspaceDirs() {
  mkdirSync(paths.uploadsDir, { recursive: true });
  mkdirSync(paths.outputsDir, { recursive: true });
  mkdirSync(paths.dataDir, { recursive: true });
  mkdirSync(paths.parsedDir, { recursive: true });
}
