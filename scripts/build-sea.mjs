import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(rootDir, "dist", "sea");
const bundlePath = path.join(distDir, "ai.mjs");
const seaConfigPath = path.join(distDir, "sea-config.json");
const seaBlobPath = path.join(distDir, "sea-prep.blob");
const outputBinaryPath = path.join(distDir, process.platform === "win32" ? "ai.exe" : "ai");
const postjectBin = path.join(rootDir, "node_modules", ".bin", process.platform === "win32" ? "postject.cmd" : "postject");
const sentinelFuse = "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2";
const nodeMajor = Number(process.versions.node.split(".")[0]);

if (nodeMajor < 25) {
  throw new Error(`SEA ESM builds require Node 25 or newer. Current Node: ${process.versions.node}`);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    stdio: "inherit",
    ...options,
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} exited with code ${result.status ?? 1}`);
  }
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function fileExists(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

ensureDir(distDir);

await build({
  entryPoints: [path.join(rootDir, "bin", "ai.js")],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node25",
  banner: {
    js: 'import { createRequire as __seaCreateRequire } from "node:module"; const require = globalThis.require ?? __seaCreateRequire(import.meta.url);',
  },
  outfile: bundlePath,
});

fs.writeFileSync(
  seaConfigPath,
  JSON.stringify(
    {
      main: bundlePath,
      mainFormat: "module",
      output: seaBlobPath,
      disableExperimentalSEAWarning: true,
    },
    null,
    2,
  ) + "\n",
);

run(process.execPath, ["--experimental-sea-config", seaConfigPath]);

fs.copyFileSync(process.execPath, outputBinaryPath);
fs.chmodSync(outputBinaryPath, 0o755);

if (fileExists(postjectBin)) {
  if (process.platform === "darwin") {
    run("codesign", ["--remove-signature", outputBinaryPath]);
  }

  const postjectArgs = [
    outputBinaryPath,
    "NODE_SEA_BLOB",
    seaBlobPath,
    "--sentinel-fuse",
    sentinelFuse,
    "--overwrite",
  ];

  if (process.platform === "darwin") {
    postjectArgs.push("--macho-segment-name", "NODE_SEA");
  }

  run(postjectBin, postjectArgs);

  if (process.platform === "darwin") {
    run("codesign", ["--force", "--sign", "-", outputBinaryPath]);
  }

  console.error(`SEA binary written to ${outputBinaryPath}`);
} else {
  console.error("Built SEA blob and copied the Node executable, but postject was not found.");
  console.error("Run the following command to inject the blob:");
  const manualPostjectArgs = [
    `${process.platform === "win32" ? "postject.cmd" : "postject"}`,
    outputBinaryPath,
    "NODE_SEA_BLOB",
    seaBlobPath,
    "--sentinel-fuse",
    sentinelFuse,
    "--overwrite",
  ];
  if (process.platform === "darwin") {
    manualPostjectArgs.push("--macho-segment-name", "NODE_SEA");
  }
  console.error(manualPostjectArgs.join(" "));
}
