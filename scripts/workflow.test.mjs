import test from 'node:test';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkVersion, syncVersion } from './version.mjs';
import { prepareRelease } from './prepare-release.mjs';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'ledger-workflow-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const write = (path, data) => {
    const segments = path.split('/');
    mkdirSync(join(root, ...segments.slice(0, -1)), { recursive: true });
    writeFileSync(join(root, path), typeof data === 'string' ? data : JSON.stringify(data));
  };
  write('package.json', { version: '3.2.3' });
  write('package-lock.json', { version: '3.2.3', packages: { '': { version: '3.2.3' } } });
  write('src-tauri/tauri.conf.json', { version: '3.2.3' });
  write('src-tauri/Cargo.toml', '[package]\nname = "app"\nversion = "3.2.3"\n\n[dependencies]\n');
  write('src-tauri/Cargo.lock', 'version = 3\n\n[[package]]\nname = "app"\nversion = "3.2.3"\n\n[[package]]\nname = "dependency"\nversion = "1.0.0"\nchecksum = "keep"\n');
  const bundles = 'src-tauri/target/release/bundle';
  write(`${bundles}/nsis/Ledger Pro Max_3.2.3_x64-setup.exe`, 'installer');
  write(`${bundles}/nsis/Ledger Pro Max_3.2.3_x64-setup.exe.sig`, 'signature\n');
  write(`${bundles}/msi/Ledger Pro Max_3.2.3_x64_zh-CN.msi`, 'installer');
  write(`${bundles}/msi/Ledger Pro Max_3.2.3_x64_zh-CN.msi.sig`, 'signature\n');
  return { root, write, bundles };
}

test('version check rejects mismatched lockfiles and release tags', t => {
  const { root, write } = fixture(t);
  assert.equal(checkVersion(root, 'v3.2.3'), '3.2.3');
  assert.throws(() => checkVersion(root, 'v3.2.4'), /Release tag/);
  write('package-lock.json', { version: '2.0.0', packages: { '': { version: '2.0.0' } } });
  assert.throws(() => checkVersion(root), /package-lock/);
  syncVersion(root);
  write('src-tauri/Cargo.lock', '[[package]]\nname = "app"\nversion = "3.1.1"\n');
  assert.throws(() => checkVersion(root), /Cargo.lock/);
});

test('version sync preserves dependency entries and is repeatable', t => {
  const { root } = fixture(t);
  assert.equal(syncVersion(root, '3.2.4'), '3.2.4');
  const lock = readFileSync(join(root, 'src-tauri/Cargo.lock'), 'utf8');
  assert.match(lock, /name = "dependency"\nversion = "1.0.0"\nchecksum = "keep"/);
  syncVersion(root, '3.2.4');
  assert.equal(readFileSync(join(root, 'src-tauri/Cargo.lock'), 'utf8'), lock);
  assert.throws(() => syncVersion(root, 'invalid'), /Invalid stable version/);
  assert.equal(checkVersion(root), '3.2.4');
});

test('release uses GitHub-safe asset names and hashes the uploaded filenames', t => {
  const { root } = fixture(t);
  const updater = prepareRelease(root, 'v3.2.3', 'TimeTravelCoder/LedgerProMax');
  assert.match(updater.platforms['windows-x86_64'].url, /Ledger\.Pro\.Max_3\.2\.3_x64-setup\.exe$/);
  assert.equal(updater.platforms['windows-x86_64'].signature, 'signature');
  const hashes = readFileSync(join(root, 'release/SHA256SUMS'), 'utf8').trim().split('\n');
  assert.equal(hashes.length, 5);
  for (const line of hashes) {
    const [, expectedHash, name] = line.match(/^([a-f0-9]{64})  (.+)$/);
    assert.match(name, /^[A-Za-z0-9._-]+$/);
    assert.equal(createHash('sha256').update(readFileSync(join(root, 'release', name))).digest('hex'), expectedHash);
  }
  assert.equal(readFileSync(join(root, 'release/Ledger.Pro.Max_3.2.3_x64-setup.exe'), 'utf8'), 'installer');
  assert.equal(readFileSync(join(root, 'release/Ledger.Pro.Max_3.2.3_x64-setup.exe.sig'), 'utf8'), 'signature\n');
  assert.ok(hashes.every(line => /^[a-f0-9]{64}  .+$/.test(line)));
  assert.throws(() => prepareRelease(root, 'v3.2.3', 'TimeTravelCoder/LedgerProMax'), /must be empty/);
});

test('release rejects missing installers, duplicate installers and missing or empty signatures', t => {
  for (const failure of ['missing', 'duplicate', 'missing-signature', 'empty-signature']) {
    const { root, write, bundles } = fixture(t);
    const installer = `${bundles}/nsis/Ledger Pro Max_3.2.3_x64-setup.exe`;
    if (failure === 'missing') rmSync(join(root, installer));
    if (failure === 'duplicate') write(`${bundles}/nsis/stale-setup.exe`, 'stale');
    if (failure === 'missing-signature') rmSync(join(root, `${installer}.sig`));
    if (failure === 'empty-signature') write(`${installer}.sig`, ' \n');
    assert.throws(() => prepareRelease(root, 'v3.2.3', 'TimeTravelCoder/LedgerProMax'), /installer|signature/);
  }
});

test('version sync accepts Windows CRLF without changing dependency versions', t => {
  const { root } = fixture(t);
  for (const file of ['src-tauri/Cargo.toml', 'src-tauri/Cargo.lock']) {
    const path = join(root, file);
    writeFileSync(path, readFileSync(path, 'utf8').replace(/\r?\n/g, '\r\n'));
  }
  assert.equal(checkVersion(root), '3.2.3');
  assert.equal(syncVersion(root, '3.2.4'), '3.2.4');
  assert.ok(readFileSync(join(root, 'src-tauri/Cargo.lock'), 'utf8').includes('name = "dependency"\r\nversion = "1.0.0"\r\nchecksum = "keep"'));
  assert.equal(syncVersion(root, '3.2.4'), '3.2.4');
});
