import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { ensureWorkspaceDirs, paths } from "../lib/paths";

type MetadataStore = {
  files: unknown[];
  tasks: unknown[];
};

const metadataFile = resolve(paths.dataDir, "metadata.json");

function createEmptyStore(): MetadataStore {
  return {
    files: [],
    tasks: []
  };
}

export function ensureMetadataStore() {
  ensureWorkspaceDirs();
  if (!existsSync(metadataFile)) {
    writeFileSync(metadataFile, JSON.stringify(createEmptyStore(), null, 2), "utf8");
  }
}

export function readMetadataStore() {
  ensureMetadataStore();
  return JSON.parse(readFileSync(metadataFile, "utf8")) as MetadataStore;
}

export function writeMetadataStore(store: MetadataStore) {
  writeFileSync(metadataFile, JSON.stringify(store, null, 2), "utf8");
}
