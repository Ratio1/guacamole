#!/usr/bin/env node
/**
 * Lightweight helper to run r1-plugins-sandbox locally.
 * - Downloads the correct binary if missing (Linux/macOS x64/arm64).
 * - Starts sandbox with explicit ports: CStore :8787, R1FS :8788.
 * - Prints the env vars you need for Next.js dev.
 */
import { mkdirSync, existsSync, chmodSync } from 'node:fs';
import { basename, join } from 'node:path';
import { spawnSync, spawn } from 'node:child_process';
import os from 'node:os';

const BIN_DIR = join(process.cwd(), 'bin');
const BIN_PATH = join(BIN_DIR, 'r1-plugins-sandbox');
const CSTORE_PORT = 31234;
const R1FS_PORT = 31235;

function detectAsset() {
  const platform = os.platform();
  const arch = os.arch();
  if (platform === 'darwin' && arch === 'arm64') return 'r1-plugins-sandbox_mac_arm64.zip';
  if (platform === 'darwin') return 'r1-plugins-sandbox_mac_amd64.zip';
  if (platform === 'linux' && arch === 'arm64') return 'r1-plugins-sandbox_linux_arm64.tar.gz';
  if (platform === 'linux') return 'r1-plugins-sandbox_linux_amd64.tar.gz';
  throw new Error(`Unsupported platform ${platform}/${arch}. Please download manually.`);
}

function ensureBinary() {
  if (existsSync(BIN_PATH)) {
    return;
  }
  mkdirSync(BIN_DIR, { recursive: true });
  const asset = detectAsset();
  const url = `https://github.com/Ratio1/r1-plugins-sandbox/releases/latest/download/${asset}`;
  const downloadTarget = join(BIN_DIR, basename(asset));
  console.log(`Downloading sandbox binary: ${url}`);
  const curl = spawnSync('curl', ['-L', url, '-o', downloadTarget], { stdio: 'inherit' });
  if (curl.status !== 0) {
    throw new Error('Failed to download sandbox binary.');
  }

  if (asset.endsWith('.tar.gz')) {
    const untar = spawnSync('tar', ['-xzf', downloadTarget, '-C', BIN_DIR], { stdio: 'inherit' });
    if (untar.status !== 0) {
      throw new Error('Failed to extract sandbox tarball.');
    }
  } else if (asset.endsWith('.zip')) {
    const unzip = spawnSync('unzip', ['-o', downloadTarget, '-d', BIN_DIR], { stdio: 'inherit' });
    if (unzip.status !== 0) {
      throw new Error('Failed to extract sandbox zip.');
    }
  } else {
    throw new Error(`Unknown asset format: ${asset}`);
  }

  // Binary may be nested; attempt to locate it.
  if (!existsSync(BIN_PATH)) {
    // Common extraction outputs.
    const candidates = [
      join(BIN_DIR, 'r1-plugins-sandbox.exe'),
      join(BIN_DIR, 'r1-plugins-sandbox.app', 'Contents', 'MacOS', 'r1-plugins-sandbox')
    ].filter(existsSync);
    if (candidates.length === 0) {
      throw new Error('Could not locate sandbox binary after extraction.');
    }
    const target = candidates[0];
    spawnSync('mv', [target, BIN_PATH], { stdio: 'inherit' });
  }

  chmodSync(BIN_PATH, 0o755);
}

function startSandbox() {
  console.log('Starting r1-plugins-sandbox...');
  console.log(`CStore: http://127.0.0.1:${CSTORE_PORT}`);
  console.log(`R1FS:   http://127.0.0.1:${R1FS_PORT}`);
  console.log('Env to export:');
  console.log(`  EE_CHAINSTORE_API_URL=http://127.0.0.1:${CSTORE_PORT}`);
  console.log(`  EE_R1FS_API_URL=http://127.0.0.1:${R1FS_PORT}`);

  const child = spawn(
    BIN_PATH,
    [`--cstore-addr=:${CSTORE_PORT}`, `--r1fs-addr=:${R1FS_PORT}`],
    { stdio: 'inherit' }
  );
  child.on('exit', (code) => process.exit(code ?? 0));
}

try {
  ensureBinary();
  startSandbox();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
