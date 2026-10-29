import { useState } from "react";
import { FolderOpen, Plus, Edit3, Trash2 } from "lucide-react";
import type { WorkspaceTemplate } from "../../types";
import { getWorkspaceDirectories, parseDirectoryLines, validateWorkspaceTemplate } from "../../utils/workspaceTemplates";

interface Props {
  selection: string;
  onSelect: (value: string) => void;
  templates: WorkspaceTemplate[];
  onTemplatesChange: (templates: WorkspaceTemplate[]) => void;
  currentDirs: string[];
}

export default function WorkspaceTemplateEditor({ selection, onSelect, templates, onTemplatesChange, currentDirs }: Props) {
  const [editor, setEditor] = useState<{ id: string | null; name: string; text: string } | null>(null);
  const [error, setError] = useState("");
  const selected = templates.find(item => `custom:${item.id}` === selection);
  const dirs = getWorkspaceDirectories(selection, templates);
  const startEditor = (template?: WorkspaceTemplate) => {
    setError("");
    setEditor({ id: template?.id || null, name: template?.name || "", text: (template?.dirs || dirs).join("\n") });
  };
  const saveEditor = () => {
    if (!editor) return;
    if (!editor.id && templates.length >= 20) { setError("最多保存 20 个模板，请先移除不再使用的模板。"); return; }
    const template = { id: editor.id || crypto.randomUUID(), name: editor.name.trim(), dirs: parseDirectoryLines(editor.text) };
    const validation = validateWorkspaceTemplate(template, templates);
    if (validation) { setError(validation); return; }
    onTemplatesChange(editor.id ? templates.map(item => item.id === editor.id ? template : item) : [...templates, template]);
    onSelect(`custom:${template.id}`);
    setEditor(null);
    setError("");
  };
  return <div className="settings-field settings-field--wide settings-workspace-preset">
    <label htmlFor="workspace-preset">工作空间目录模板</label>
    <div className="workspace-template-toolbar">
      <select id="workspace-preset" className="input-field" value={selection} onChange={event => { onSelect(event.target.value); setEditor(null); }}>
        <optgroup label="内置模板">
          <option value="zh-full">中文标准版（12 个目录）</option>
          <option value="zh-min">中文精简版（6 个目录）</option>
          <option value="zh-basic">中文基础版（仅收集箱）</option>
          <option value="en-full">English Standard（12 dirs）</option>
          <option value="en-min">English Minimal（6 dirs）</option>
          <option value="en-basic">English Basic（Inbox only）</option>
        </optgroup>
        {templates.length > 0 && <optgroup label="我的模板">{templates.map(item => <option key={item.id} value={`custom:${item.id}`}>{item.name}（{item.dirs.length} 个目录）</option>)}</optgroup>}
      </select>
      <button type="button" className="btn" onClick={() => startEditor()}><Plus size={15} />自建模板</button>
      {selected && <>
        <button type="button" className="btn" onClick={() => startEditor(selected)}><Edit3 size={15} />编辑</button>
        <button type="button" className="btn" onClick={() => { onTemplatesChange(templates.filter(item => item.id !== selected.id)); onSelect("zh-full"); setEditor(null); }}><Trash2 size={15} />移除模板</button>
      </>}
    </div>
    {editor && <div className="workspace-template-editor">
      <h5>{editor.id ? "编辑目录模板" : "自建目录模板"}</h5>
      <label htmlFor="workspace-template-name">模板名称</label>
      <input id="workspace-template-name" className="input-field" value={editor.name} maxLength={80} placeholder="例如：客户项目资料" onChange={event => setEditor({ ...editor, name: event.target.value })} />
      <div className="workspace-template-toolbar"><label htmlFor="workspace-template-dirs">目录列表</label><button type="button" className="btn" onClick={() => setEditor({ ...editor, text: currentDirs.join("\n") })}>使用当前工作区目录</button></div>
      <textarea id="workspace-template-dirs" className="input-field" rows={7} value={editor.text} onChange={event => setEditor({ ...editor, text: event.target.value })} aria-describedby="workspace-template-help" />
      <p id="workspace-template-help" className="about-description">每行一个一级目录，第一行作为收集箱。可以使用自己的名称，无需数字编号。</p>
      {error && <p role="alert" className="settings-status warn">{error}</p>}
      <div className="workspace-template-toolbar"><button type="button" className="btn btn-primary" onClick={saveEditor}>{editor.id ? "完成编辑" : "完成创建"}</button><button type="button" className="btn" onClick={() => setEditor(null)}>取消</button></div>
    </div>}
    <p className="about-description">目录预览 · {dirs.length} 个一级目录</p>
    <ol className="workspace-template-preview">{dirs.map((dir, index) => <li key={dir}><FolderOpen size={14} /><span>{dir}</span>{index === 0 && <small>收集箱</small>}</li>)}</ol>
    <p className="about-description">点击底部“保存设置”后生效，只创建缺少的目录，不移动或删除现有文件。移除模板也不会删除文件夹。</p>
  </div>;
}
