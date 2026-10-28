import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const projectRoot = fileURLToPath(new URL('../', import.meta.url));
export const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const read = (root, path) => readFileSync(resolve(root, path), 'utf8');
const json = (root, path) => JSON.parse(read(root, path));

export function checkVersion(root = projectRoot, tag) {
  const version = json(root, 'package.json').version;
  if (!versionPattern.test(version)) throw new Error(`Invalid stable version: ${version}`);
  const npmLock = json(root, 'package-lock.json');
  const manifest = read(root, 'src-tauri/Cargo.toml');
  const cargoLock = read(root, 'src-tauri/Cargo.lock');
  const packageBlock = manifest.match(/\[package\]([\s\S]*?)(?=\n\[|$)/)?.[1];
  const appBlock = cargoLock.split('[[package]]').find(block => /^name = "app"\r?$/m.test(block));
  const versions = {
    'package-lock.json': npmLock.version,
    'package-lock.json packages[""]': npmLock.packages?.['']?.version,
    'src-tauri/tauri.conf.json': json(root, 'src-tauri/tauri.conf.json').version,
    'src-tauri/Cargo.toml': packageBlock?.match(/^version = "([^"]+)"\r?$/m)?.[1],
    'src-tauri/Cargo.lock (app)': appBlock?.match(/^version = "([^"]+)"\r?$/m)?.[1],
  };
  for (const [file, value] of Object.entries(versions)) {
    if (value !== version) throw new Error(`${file}: ${value} != package.json ${version}`);
  }
  if (tag !== undefined && tag !== `v${version}`) {
    throw new Error(`Release tag ${tag} must equal v${version}`);
  }
  return version;
}

export function syncVersion(root = projectRoot, requestedVersion) {
  const version = requestedVersion ?? json(root, 'package.json').version;
  if (!versionPattern.test(version)) throw new Error(`Invalid stable version: ${version}`);
  const packageJson = json(root, 'package.json');
  const npmLock = json(root, 'package-lock.json');
  const tauri = json(root, 'src-tauri/tauri.conf.json');
  const manifest = read(root, 'src-tauri/Cargo.toml');
  const lock = read(root, 'src-tauri/Cargo.lock');
  if (!npmLock.packages?.[''] || !/\[package\][\s\S]*?^version = "[^"]+"/m.test(manifest)
      || !/name = "app"\r?\nversion = "[^"]+"/.test(lock)) {
    throw new Error('Expected package/version entries are missing; no files changed');
  }
  packageJson.version = npmLock.version = npmLock.packages[''].version = tauri.version = version;
  for (const [file, value] of [['package.json', packageJson], ['package-lock.json', npmLock], ['src-tauri/tauri.conf.json', tauri]]) {
    if (JSON.stringify(json(root, file)) !== JSON.stringify(value)) {
      writeFileSync(resolve(root, file), `${JSON.stringify(value, null, 2)}\n`);
    }
  }
  writeFileSync(resolve(root, 'src-tauri/Cargo.toml'), manifest.replace(/(\[package\][\s\S]*?^version = ")[^"]+"/m, `$1${version}"`));
  writeFileSync(resolve(root, 'src-tauri/Cargo.lock'), lock.replace(/(name = "app"\r?\nversion = ")[^"]+"/, `$1${version}"`));
  return checkVersion(root);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    let version;
    if (args[0] === '--sync' && args.length <= 2) version = syncVersion(projectRoot, args[1]);
    else if (args.length === 0 || (args[0] === '--tag' && args.length === 2)) version = checkVersion(projectRoot, args[1]);
    else throw new Error('Usage: version.mjs [--sync [X.Y.Z] | --tag vX.Y.Z]');
    console.log(`Version consistent: ${version}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
