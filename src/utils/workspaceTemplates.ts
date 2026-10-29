import type { WorkspaceTemplate } from "../types";

export const standardDirsZhFull = [
  "00收集箱", "01课程学习", "02课题研究", "03项目管理", "04代码仓库",
  "05学术论文", "06知识笔记", "07常用资源", "08演示汇报", "09个人简历",
  "10归档区", "99临时缓冲"
];

export const standardDirsZhMin = [
  "00收集箱", "01课程学习", "02课题研究", "03项目管理",
  "10归档区", "99临时缓冲"
];

export const standardDirsEnFull = [
  "00Inbox", "01Courses", "02Research", "03Projects", "04Code",
  "05Papers", "06Notes", "07Resources", "08Slides", "09Resumes",
  "10Archive", "99Sandbox"
];

export const standardDirsEnMin = [
  "00Inbox", "01Courses", "02Research", "03Projects",
  "10Archive", "99Sandbox"
];

export const standardDirsZhBasic = ["A0-收集箱"];
export const standardDirsEnBasic = ["A0-Inbox"];

export const standardDirPresets: Record<string, string[]> = {
  "zh-full": standardDirsZhFull,
  "zh-min": standardDirsZhMin,
  "zh-basic": standardDirsZhBasic,
  "en-full": standardDirsEnFull,
  "en-min": standardDirsEnMin,
  "en-basic": standardDirsEnBasic,
};

export const parseDirectoryLines = (text: string): string[] => text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);

export function validateDirectoryName(name: string): string | null {
  if (!name || name !== name.trim() || name === "." || name === "..") return "目录名称不能为空，也不能是 . 或 ..。";
  if (name.length > 255 || /[<>:"/\\|?*]/.test(name) || Array.from(name).some(char => char.charCodeAt(0) < 32 || (char.charCodeAt(0) >= 127 && char.charCodeAt(0) <= 159))) return `目录“${name}”包含不支持的字符或长度超限。`;
  if (/[. ]$/.test(name) || /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(name)) return `目录“${name}”不是有效的 Windows 文件夹名称。`;
  if (name.startsWith(".")) return "目录名称不能以点号开头。";
  return null;
}

export function validateWorkspaceTemplate(template: WorkspaceTemplate, others: WorkspaceTemplate[] = []): string | null {
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(template.id)) return "模板标识无效。";
  if (!template.name.trim() || template.name.length > 80) return "请填写模板名称（不超过 80 个字符）。";
  if (others.some(item => item.id !== template.id && item.name.trim().toLowerCase() === template.name.trim().toLowerCase())) return "模板名称已存在。";
  if (!template.dirs.length || template.dirs.length > 50) return "请填写 1 至 50 个一级目录，每行一个。";
  const seen = new Set<string>();
  for (const dir of template.dirs) {
    const error = validateDirectoryName(dir);
    if (error) return error;
    if (seen.has(dir.toLowerCase())) return `目录“${dir}”重复。`;
    seen.add(dir.toLowerCase());
  }
  return null;
}

export function readWorkspaceTemplates(value: unknown): WorkspaceTemplate[] {
  if (!Array.isArray(value)) return [];
  const result: WorkspaceTemplate[] = [];
  for (const item of value) {
    if (!item || typeof item.id !== "string" || typeof item.name !== "string" || !Array.isArray(item.dirs) || !item.dirs.every((dir: unknown) => typeof dir === "string")) continue;
    const template: WorkspaceTemplate = { id: item.id, name: item.name, dirs: [...item.dirs] };
    if (!result.some(other => other.id === template.id) && !validateWorkspaceTemplate(template, result) && result.length < 20) result.push(template);
  }
  return result;
}

export function getWorkspaceDirectories(selection: string, templates: WorkspaceTemplate[]): string[] {
  if (selection.startsWith("custom:")) {
    const template = templates.find(item => `custom:${item.id}` === selection);
    if (template && !validateWorkspaceTemplate(template)) return [...template.dirs];
  }
  return [...(standardDirPresets[selection] || standardDirsZhFull)];
}

export function mergeWorkspaceDirectories(templateDirs: string[], actualDirs: string[]): string[] {
  const seen = new Set<string>();
  return [...templateDirs, ...actualDirs].filter(dir => {
    if (validateDirectoryName(dir) || seen.has(dir.toLowerCase())) return false;
    seen.add(dir.toLowerCase());
    return true;
  });
}

export function resolveRuleDirectory(dirs: string[], target: string): string | undefined {
  return dirs.find(dir => dir === target) || (/^[a-zA-Z0-9]{2}$/.test(target) ? dirs.find(dir => dir.startsWith(target)) : undefined);
}
