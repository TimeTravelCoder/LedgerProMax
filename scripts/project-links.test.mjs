import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = ts.createSourceFile('AboutPage.tsx', readFileSync(new URL('../src/components/pages/AboutPage.tsx', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const component = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'AboutPage');
const handler = component.body.statements.find(node => ts.isVariableStatement(node) && node.declarationList.declarations.some(declaration => declaration.name.getText(source) === 'handleOpenLink'));
assert.ok(handler);
const code = ts.transpileModule(ts.createPrinter().printNode(ts.EmitHint.Unspecified, handler, source), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText;

function harness({ desktop = true, gate, fail = false } = {}) {
  const calls = { opened: [], prevented: 0, errors: [] };
  const openingLink = { current: false };
  const context = vm.createContext({
    openingLink,
    isTauri: () => desktop,
    setLinkError: value => calls.errors.push(value),
    openUrl: async url => { calls.opened.push(url); if (gate) await gate; if (fail) throw new Error('browser unavailable'); },
    console: { error() {} },
  });
  vm.runInContext(code, context);
  return { calls, openingLink, run: url => { context.url = url; context.event = { preventDefault: () => calls.prevented++ }; return vm.runInContext('handleOpenLink(event, url)', context); } };
}

for (const suffix of ['', '/releases']) {
  test(`desktop link ${suffix || 'repository'} opens in the system browser`, async () => {
    const fixture = harness();
    const url = `https://github.com/TimeTravelCoder/LedgerProMax${suffix}`;
    await fixture.run(url);
    assert.deepEqual(fixture.calls.opened, [url]);
    assert.equal(fixture.calls.prevented, 1);
    assert.equal(fixture.openingLink.current, false);
  });
}

test('browser preview retains ordinary link navigation', async () => {
  const fixture = harness({ desktop: false });
  await fixture.run('https://github.com/TimeTravelCoder/LedgerProMax');
  assert.equal(fixture.calls.prevented, 0);
  assert.equal(fixture.calls.opened.length, 0);
});

test('native browser errors expose the destination for manual access and allow retry', async () => {
  const fixture = harness({ fail: true });
  const url = 'https://github.com/TimeTravelCoder/LedgerProMax/releases';
  await fixture.run(url);
  assert.equal(fixture.calls.errors.at(-1), url);
  assert.equal(fixture.openingLink.current, false);
  await fixture.run(url);
  assert.equal(fixture.calls.opened.length, 2);
  assert.deepEqual(fixture.calls.errors, [null, url, null, url]);
});

test('repeated clicks while the browser is opening produce only one request', async () => {
  let release;
  const fixture = harness({ gate: new Promise(resolve => { release = resolve; }) });
  const first = fixture.run('https://github.com/TimeTravelCoder/LedgerProMax');
  await fixture.run('https://github.com/TimeTravelCoder/LedgerProMax/releases');
  assert.equal(fixture.calls.opened.length, 1);
  release();
  await first;
  assert.equal(fixture.openingLink.current, false);
});
