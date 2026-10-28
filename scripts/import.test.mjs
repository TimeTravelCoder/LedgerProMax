import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Exercise the actual UI handlers with IPC failures without a desktop session.
const source = ts.createSourceFile('App.tsx', readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const app = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'App');
const names = ['handleBatchImportToInbox', 'handleImportToInbox'];
const functions = app.body.statements.filter(node => ts.isFunctionDeclaration(node) && names.includes(node.name?.text));
assert.equal(functions.length, names.length);
const printer = ts.createPrinter();
const code = ts.transpileModule(functions.map(node => printer.printNode(ts.EmitHint.Unspecified, node, source)).join('\n'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText;

async function runImport(paths) {
  const messages = [];
  const context = vm.createContext({
    workspaceDirRef: { current: 'fixture' },
    inboxNameRef: { current: '00收集箱' },
    toastTimeoutRef: { current: null },
    console: { error() {} },
    invoke: async (_command, args) => {
      if (args.srcPath.includes('fail')) throw new Error('file is unavailable');
      return args.destRelPath;
    },
    handleScanWorkspace: async () => [],
    setNotification() {}, setActiveTab() {}, addLog() {},
    showToast(message, type) { messages.push({ message, type }); },
    paths,
  });
  vm.runInContext(code, context);
  await vm.runInContext('handleBatchImportToInbox(paths)', context);
  return messages;
}

test('failed imports do not emit a success summary', async () => {
  const messages = await runImport(['C:\\fail.txt']);
  assert.equal(messages.filter(message => message.type === 'error').length, 1);
  assert.equal(messages.filter(message => message.type === 'success').length, 0);
});

test('mixed batch counts only successful imports and continues after a failure', async () => {
  const messages = await runImport(['C:\\ok.txt', 'C:\\fail.txt', 'C:\\another.txt']);
  assert.equal(messages.filter(message => message.type === 'error').length, 1);
  assert.deepEqual(messages.filter(message => message.type === 'success').map(message => message.message), ['成功导入 2 个外部文件至收集箱！']);
});
