#!/usr/bin/env node
import { config as loadEnv } from "dotenv";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const argv = process.argv.slice(2);

let mode = "final";
if (argv[0]?.startsWith("--env=")) {
  mode = argv.shift().split("=")[1] || mode;
} else if (argv[0] === "--env") {
  if (!argv[1]) {
    console.error("Expected value after --env");
    process.exit(1);
  }
  mode = argv[1];
  argv.splice(0, 2);
}

if (argv.length === 0) {
  console.error("No command provided to run-with-env");
  process.exit(1);
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const envFiles = [];
const baseEnvPath = path.join(repoRoot, ".env");
if (mode !== "none") envFiles.push({ path: baseEnvPath, override: false });

if (mode === "local" || mode === "development") {
  envFiles.push({ path: path.join(repoRoot, ".env.local"), override: true });
} else if (mode && mode !== "final" && mode !== "production" && mode !== "base") {
  const customPath = path.isAbsolute(mode) ? mode : path.join(repoRoot, mode);
  envFiles.push({ path: customPath, override: true });
}

for (const entry of envFiles) {
  if (!fs.existsSync(entry.path)) continue;
  loadEnv({ path: entry.path, override: entry.override });
}

process.env.CIRCULOOS_ENV_MODE = mode;

const child = spawn(argv[0], argv.slice(1), {
  stdio: "inherit",
  cwd: process.cwd(),
  env: process.env,
});

const forwardSignals = ["SIGINT", "SIGTERM", "SIGQUIT"];
forwardSignals.forEach(signal => {
  process.on(signal, () => {
    if (!child.killed) child.kill(signal);
  });
});

child.on("exit", code => {
  process.exit(code ?? 0);
});

child.on("error", err => {
  console.error(err);
  process.exit(1);
});
