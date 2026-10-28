import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = ts.createSourceFile('App.tsx', readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const app = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'App');
const handler = app.body.statements.find(node => ts.isVariableStatement(node) && node.declarationList.declarations.some(declaration => declaration.name.getText(source) === 'handleCheckForUpdates'));
assert.ok(handler);
const code = ts.transpileModule(ts.createPrinter().printNode(ts.EmitHint.Unspecified, handler, source).replaceAll('import.meta.env.DEV', 'development'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText;

function harness({ development = false, hasUpdate = true, confirm = true, failAt, knownSize = true, gate, dirty = false } = {}) {
  const calls = { checks: 0, downloads: 0, installs: 0, confirms: 0, closes: 0, busy: [], messages: [], statuses: [] };
  const lock = { current: false };
  const context = vm.createContext({
    development, updateInProgressRef: lock, dirtyRef: { current: dirty },
    setIsCheckingUpdate: value => calls.busy.push(value),
    setUpdateStatus: value => calls.statuses.push(value),
    showToast: (message, type) => calls.messages.push({ message, type }),
    check: async options => {
      calls.checks++;
      assert.equal(options.timeout, 15000);
      if (gate) await gate;
      if (failAt === 'check') throw new Error('request timed out');
      return hasUpdate ? {
        version: '3.2.4', body: 'Release notes',
        download: async (onEvent, options) => {
          calls.downloads++;
          assert.equal(options.timeout, 300000);
          onEvent({ event: 'Started', data: knownSize ? { contentLength: 100 } : {} });
          onEvent({ event: 'Progress', data: { chunkLength: 50 } });
          if (failAt === 'download') throw new Error('download or signature failed');
          onEvent({ event: 'Finished' });
        },
        install: async () => {
          calls.installs++;
          if (failAt === 'install') throw new Error('installer failed');
        },
        close: async () => {
          calls.closes++;
          if (failAt === 'close') throw new Error('close failed');
        },
      } : null;
    },
    setUpdateErrorDetail: () => {},
    setUpdateProgress: () => {},
    requestConfirmation: async () => { calls.confirms++; return confirm; },
    window: { confirm: () => { calls.confirms++; return confirm; } },
    console: { error() {} },
  });
  vm.runInContext(code, context);
  return {
    calls,
    run: (manual = true) => vm.runInContext(`handleCheckForUpdates(${manual})`, context),
    assertIdle() { assert.equal(lock.current, false); assert.deepEqual(calls.busy, [true, false]); },
  };
}

async function run(options, manual = true) {
  const fixture = harness(options);
  await fixture.run(manual);
  fixture.assertIdle();
  return fixture.calls;
}

test('development checks release their resource and never download or install', async () => {
  const calls = await run({ development: true });
  assert.equal(calls.downloads, 0);
  assert.equal(calls.installs, 0);
  assert.equal(calls.confirms, 0);
  assert.equal(calls.closes, 1);
  assert.ok(calls.statuses.some(message => message.includes('3.2.4') && message.includes('开发构建')));
});

test('matching release version is not proof that development changes are published', async () => {
  const calls = await run({ development: true, hasUpdate: false });
  assert.ok(calls.statuses.some(message => message === '暂无更新的正式版本（当前为开发构建）。'));
  assert.equal(calls.closes, 0);
});

test('production download shows progress and requests installation without claiming completion', async () => {
  const calls = await run();
  assert.equal(calls.confirms, 1);
  assert.equal(calls.downloads, 1);
  assert.equal(calls.installs, 1);
  assert.equal(calls.closes, 1);
  assert.ok(calls.statuses.some(message => message.includes('50%')));
  assert.ok(calls.statuses.some(message => message.includes('签名')));
  assert.ok(calls.statuses.at(-1).includes('安装请求已提交'));
  assert.ok(!calls.messages.some(({ message }) => message.includes('更新安装成功')));
});

test('unknown content length displays downloaded bytes instead of invalid percentages', async () => {
  const calls = await run({ knownSize: false });
  assert.ok(calls.statuses.some(message => message.includes('MB')));
  assert.ok(calls.statuses.every(message => !/NaN|Infinity/.test(message)));
});

test('cancelling an update releases resources without downloading', async () => {
  const calls = await run({ confirm: false });
  assert.equal(calls.closes, 1);
  assert.equal(calls.downloads, 0);
  assert.equal(calls.installs, 0);
  assert.ok(calls.statuses.at(-1).includes('已取消'));
});

for (const phase of ['check', 'download', 'install']) {
  test(`${phase} failure restores the button and reports the correct phase`, async () => {
    const calls = await run({ failAt: phase });
    assert.equal(calls.closes, phase === 'check' ? 0 : 1);
    assert.equal(calls.messages.at(-1).type, 'error');
    const label = { check: '检查更新失败', download: '下载或签名校验失败', install: '启动安装程序失败' }[phase];
    assert.ok(calls.statuses.at(-1).includes(label));
    if (phase === 'download') assert.equal(calls.installs, 0);
  });
}

test('an accepted automatic update still reports download failures', async () => {
  const calls = await run({ failAt: 'download' }, false);
  assert.equal(calls.messages.at(-1).type, 'error');
});

test('resource cleanup errors do not leave the update button locked', async () => {
  const calls = await run({ failAt: 'close', confirm: false });
  assert.equal(calls.closes, 1);
});

test('concurrent triggers share one check even before React rerenders', async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const fixture = harness({ gate, hasUpdate: false });
  const first = fixture.run();
  await fixture.run();
  assert.equal(fixture.calls.checks, 1);
  release();
  await first;
  fixture.assertIdle();
});
const navigation = app.body.statements.find(node => ts.isVariableStatement(node) && node.declarationList.declarations.some(declaration => declaration.name.getText(source) === 'setActiveTab'));
const navigationCode = ts.transpileModule(ts.createPrinter().printNode(ts.EmitHint.Unspecified, navigation, source), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText;

for (const scenario of [
  { name: 'clean settings navigate without a prompt', dirty: false, confirmed: true, expected: 'workspace', prompts: 0 },
  { name: 'cancel keeps unsaved settings on screen', dirty: true, confirmed: false, expected: null, prompts: 1 },
  { name: 'confirmed navigation leaves the draft intact', dirty: true, confirmed: true, expected: 'workspace', prompts: 1 },
]) {
  test(scenario.name, async () => {
    let destination = null;
    let prompts = 0;
    const draft = { current: scenario.dirty };
    const context = vm.createContext({
      activeTabRef: { current: 'settings' }, dirtyRef: draft,
      commitActiveTab: next => { destination = next; },
      requestConfirmation: async () => { prompts++; return scenario.confirmed; },
    });
    vm.runInContext(navigationCode, context);
    vm.runInContext('setActiveTab("workspace")', context);
    await Promise.resolve();
    assert.equal(destination, scenario.expected);
    assert.equal(prompts, scenario.prompts);
    assert.equal(draft.current, scenario.dirty);
  });
}

test("updates wait for unsaved settings before installation", async () => {
  const calls = await run({ dirty: true });
  assert.equal(calls.confirms, 0);
  assert.equal(calls.downloads, 0);
  assert.equal(calls.closes, 1);
  assert.ok(calls.statuses.at(-1).includes("先保存设置"));
});
