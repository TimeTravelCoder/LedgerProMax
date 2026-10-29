import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const moduleExports = {};
const source = readFileSync(new URL('../src/utils/workspaceTemplates.ts', import.meta.url), 'utf8');
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText, { exports: moduleExports });
const { parseDirectoryLines, validateDirectoryName, validateWorkspaceTemplate, readWorkspaceTemplates, getWorkspaceDirectories, mergeWorkspaceDirectories, resolveRuleDirectory } = moduleExports;
const plain = value => JSON.parse(JSON.stringify(value));
const template = { id: 'my-projects', name: '客户项目', dirs: ['待处理', '客户项目', '合同资料'] };

test('custom templates persist and retain their first directory as inbox', () => {
  const config = JSON.parse(JSON.stringify({ workspace_lang: 'custom:my-projects', custom_workspace_templates: [template] }));
  const restored = readWorkspaceTemplates(config.custom_workspace_templates);
  assert.equal(validateWorkspaceTemplate(template), null);
  assert.deepEqual(plain(getWorkspaceDirectories(config.workspace_lang, restored)), template.dirs);
  assert.equal(getWorkspaceDirectories(config.workspace_lang, restored)[0], '待处理');
});

test('template editor handles Windows line endings and blank lines', () => {
  assert.deepEqual(plain(parseDirectoryLines(' 待处理 \r\n\r\n客户项目\n合同资料\n')), template.dirs);
});

test('templates reject unsafe names and case-insensitive duplicate directories', () => {
  for (const name of ['', '.', '..', '../outside', 'C:\\outside', 'CON', 'nul.txt', 'a?b', 'bad.', '.hidden', 'nested/dir', 'x'.repeat(256)]) {
    assert.ok(validateDirectoryName(name), name);
  }
  assert.ok(validateWorkspaceTemplate({ ...template, dirs: ['Inbox', 'inbox'] }));
  assert.ok(validateWorkspaceTemplate({ ...template, dirs: [] }));
  assert.ok(validateWorkspaceTemplate({ ...template, name: '' }));
  assert.ok(validateWorkspaceTemplate({ ...template, id: 'second' }, [template]));
});

test('legacy configurations and builtin templates remain supported', () => {
  assert.deepEqual(plain(readWorkspaceTemplates(undefined)), []);
  assert.deepEqual(plain(getWorkspaceDirectories('en-basic', [])), ['A0-Inbox']);
  assert.equal(getWorkspaceDirectories('zh-full', []).length, 12);
  assert.equal(getWorkspaceDirectories('zh-min', []).length, 6);
});

test('invalid imported template entries cannot supply directory traversal paths', () => {
  const templates = readWorkspaceTemplates([template, { ...template, id: 'unsafe', name: 'unsafe', dirs: ['../outside'] }, { id: 7 }, template]);
  assert.deepEqual(plain(templates), [template]);
});

test('actual empty root folders merge into navigation without changing the inbox or duplicating names', () => {
  assert.deepEqual(plain(mergeWorkspaceDirectories(['待处理', '客户项目'], ['合同资料', '客户项目', 'inbox', 'Inbox', '../outside'])), ['待处理', '客户项目', '合同资料', 'inbox']);
});

test('rules resolve full folder names before legacy numeric prefixes', () => {
  assert.equal(resolveRuleDirectory(['项目资料旧', '项目资料'], '项目资料'), '项目资料');
  assert.equal(resolveRuleDirectory(['05论文', '08汇报'], '05'), '05论文');
  assert.equal(resolveRuleDirectory(['客户项目'], '客户'), undefined);
  assert.equal(resolveRuleDirectory(['客户项目'], ''), undefined);
});

const appSource = ts.createSourceFile('App.tsx', readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const app = appSource.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'App');
function handlerCode(name) {
  const handler = app.body.statements.find(node => ts.isVariableStatement(node) && node.declarationList.declarations.some(declaration => declaration.name.getText(appSource) === name));
  assert.ok(handler);
  return ts.transpileModule(ts.createPrinter().printNode(ts.EmitHint.Unspecified, handler, appSource), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
}

for (const fail of [false, true]) {
  test(`root folder creation ${fail ? 'keeps the editor open on failure' : 'refreshes navigation and selects the new category'}`, async () => {
    const calls = { requests: [], refreshed: 0, closed: false, selected: null };
    const context = vm.createContext({
      canCreateFolder: true, folderValidationMessage: '', folderFinalPath: '客户资料', folderFinalParts: ['客户资料'], workspaceDir: 'C:\\Workspace',
      invoke: async (command, args) => { calls.requests.push({ command, args }); if (fail) throw new Error('access denied'); },
      addLog() {}, showToast() {}, setNewFolderInput() {}, setCreateFolderSubpath() {},
      setIsCreateFolderExpanded: expanded => { calls.closed = !expanded; },
      setSelectedCategory: value => { calls.selected = value; },
      handleRefreshData: async () => { calls.refreshed++; },
    });
    vm.runInContext(handlerCode('handleCreateFolder'), context);
    await vm.runInContext('handleCreateFolder()', context);
    assert.equal(calls.requests[0].command, 'create_folder');
    assert.equal(calls.requests[0].args.relativePath, '客户资料');
    assert.equal(calls.closed, !fail);
    assert.equal(calls.refreshed, fail ? 0 : 1);
    assert.equal(calls.selected, fail ? null : '客户资料');
  });
}

test('refresh discovers empty root folders even when no files have been indexed', async () => {
  let roots;
  const context = vm.createContext({
    workspaceDirRef: { current: 'C:\\Workspace' }, inboxNameRef: { current: '待处理' },
    invoke: async command => command === 'list_workspace_directories' ? ['客户资料'] : command === 'get_desktop_summary' ? {} : [],
    processFileRecord: value => value, setWorkspaceRootDirs: value => { roots = value; },
    setDesktopSummary() {}, setInboxFiles() {}, setWorkspaceFiles() {}, setAllWorkspaceFiles() {}, setBackupHistory() {}, setSearchVersion() {}, console,
  });
  vm.runInContext(handlerCode('handleRefreshData'), context);
  await vm.runInContext('handleRefreshData()', context);
  assert.deepEqual(roots, ['客户资料']);
});
