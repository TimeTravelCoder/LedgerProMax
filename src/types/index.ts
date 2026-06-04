export interface FileRecord {
  filepath: string;
  filename: string;
  file_size: number;
  modified_time: number;
  tags: string[];
  description: string;
  backup_disk_status: number;
  backup_cloud_status: number;
  last_backup_time?: string;
}

export interface BackupHistoryRecord {
  timestamp: string;
  backup_type: string;
  files_copied: number;
  bytes_copied: number;
  status: string;
}

export type TagGroupKey = "primary" | "secondary" | "status";

export interface AutoRule {
  name: string;
  keywords: string[];
  extensions: string[];
  target_prefix: string;
  enabled?: boolean;
}

export interface PathValidation {
  exists: boolean;
  is_dir: boolean;
  writable: boolean;
  message: string;
}

export type PathValidationMap = Record<"workspace" | "monitor" | "disk" | "cloud", PathValidation | null>;
