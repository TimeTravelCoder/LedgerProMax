import { copyFileSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { checkVersion, projectRoot } from './version.mjs';

export function prepareRelease(root, tag, repository) {
  const version = checkVersion(root, tag);
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) throw new Error('Expected GitHub owner/repository');
  const bundles = [['nsis', '-setup.exe'], ['msi', '.msi']];
  const files = [];
  for (const [folder, suffix] of bundles) {
    const dir = resolve(root, 'src-tauri/target/release/bundle', folder);
    const installers = existsSync(dir) ? readdirSync(dir).filter(name => name.endsWith(suffix)) : [];
    if (installers.length !== 1) throw new Error(`Expected exactly one ${folder} installer, found ${installers.length}`);
    const name = installers[0];
    const installer = resolve(dir, name);
    const signaturePath = `${installer}.sig`;
    if (!statSync(installer).isFile() || statSync(installer).size === 0) throw new Error(`Empty installer: ${name}`);
    if (!existsSync(signaturePath)) throw new Error(`Missing signature: ${name}.sig`);
    const signature = readFileSync(signaturePath, 'utf8').trim();
    if (!signature) throw new Error(`Empty signature: ${name}.sig`);
    files.push({ name, installer, signaturePath, signature });
  }
  const destination = resolve(root, 'release');
  if (existsSync(destination) && readdirSync(destination).length) throw new Error('release/ must be empty to prevent stale artifacts');
  mkdirSync(destination, { recursive: true });
  for (const file of files) {
    copyFileSync(file.installer, resolve(destination, file.name));
    copyFileSync(file.signaturePath, resolve(destination, `${file.name}.sig`));
  }
  const nsis = files[0];
  const updater = {
    version,
    notes: `Ledger Pro Max ${tag}`,
    pub_date: new Date().toISOString(),
    platforms: {
      'windows-x86_64': {
        signature: nsis.signature,
        url: `https://github.com/${repository}/releases/download/${encodeURIComponent(tag)}/${encodeURIComponent(nsis.name)}`,
      },
    },
  };
  writeFileSync(resolve(destination, 'updater.json'), `${JSON.stringify(updater, null, 2)}\n`);
  const hashes = readdirSync(destination).sort().map(name => {
    const hash = createHash('sha256').update(readFileSync(resolve(destination, name))).digest('hex');
    return `${hash}  ${name}`;
  });
  writeFileSync(resolve(destination, 'SHA256SUMS'), `${hashes.join('\n')}\n`);
  return updater;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [tag, repository, ...extra] = process.argv.slice(2);
    if (!tag || !repository || extra.length) throw new Error('Usage: prepare-release.mjs vX.Y.Z owner/repository');
    const updater = prepareRelease(projectRoot, tag, repository);
    console.log(`Prepared Windows release ${updater.version}: installers, signatures, updater.json and SHA256SUMS`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
