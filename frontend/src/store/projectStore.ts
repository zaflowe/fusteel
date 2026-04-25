import { create } from 'zustand';
import axios from 'axios';

const API_URL = '/api';

export type ProjectStatus = '实施中' | '已完成' | '已结项' | '暂停中';

// ABC 优先级
export type ProjectPriority = 'A' | 'B' | 'C';
// 首页 Tab 值：包含"全部 / A / B / C / 未定级"
export type PriorityFilter = '' | 'A' | 'B' | 'C' | 'unset';

export interface ProjectFile {
  id: string;
  project_id: string;
  file_type: string;
  file_url: string;
  original_name?: string;
  uploaded_by?: string;
  uploaded_at?: string;
}

export interface Milestone {
  id: string;
  project_id: string;
  title: string;
  deadline?: string;
  is_completed: boolean;
  completed_at?: string;
  created_at?: string;
}

export interface Project {
  id: string;
  project_code?: string;
  title: string;
  department?: string;
  leader?: string;
  participants: string[];
  tags: string[];
  status: ProjectStatus;
  created_at: string;
  end_date?: string;                 // 老字段，兼容历史数据，新项目不再主动使用
  delay_reason?: string;
  // 新：由 PDF/手填确定的项目周期
  planned_start_date?: string | null;
  planned_end_date?: string | null;
  // 新：人员与项目内容
  proposer?: string | null;
  post_delivery_person?: string | null;
  current_problem?: string | null;
  technical_solution?: string | null;
  files: ProjectFile[];
  milestones: Milestone[];
  // 由后端聚合写入：该项目"最近一次项目固化"的摘要（用于首页/Portal 卡片小尾巴）
  latest_update_at?: string | null;
  latest_update_summary?: string | null;
  latest_update_reporter?: string | null;
  // ABC 优先级（null = 未定级）
  priority?: ProjectPriority | null;
  priority_score?: number | null;
  priority_reason?: string | null;
  priority_set_at?: string | null;
}

// 自动打分响应（详情页"定级"板块使用）
export interface AutoScoreDimension {
  dim: string;
  value: string;
  score: number;
  rationale: string;
  manual: boolean;
}

export interface AutoScoreResponse {
  project_id: string;
  project_title: string;
  suggested_priority: ProjectPriority;
  total_score: number;
  hard_hit?: string | null;
  breakdown: AutoScoreDimension[];
  note?: string | null;
}

// ABC 数量统计
export interface PriorityStats {
  A: number;
  B: number;
  C: number;
  unset: number;
  total: number;
}

// 首页排序下拉的取值：与后端 search_projects(sort=...) 保持一致
export type ProjectSort =
  | 'latest_update_desc'   // 最近固化 · 新→旧（默认）
  | 'latest_update_asc'    // 最近固化 · 旧→新（找僵尸项目）
  | 'created_desc'         // 立项时间 · 新→旧
  | 'created_asc';         // 立项时间 · 旧→新

export interface ProjectDelayHistory {
  id: string;
  project_id: string;
  old_end_date?: string;
  new_end_date: string;
  reason: string;
  changed_by: string;
  created_at: string;
}

// 干预动作（变更记录）
export type ChangeLogAction =
  | 'field_edit'
  | 'date_edit'
  | 'date_delay'
  | 'tag_add'
  | 'tag_remove'
  | 'status_change'
  | 'file_upload'
  | 'file_delete'
  | 'pdf_import'
  | 'portal_edit';

export interface ProjectChangeLog {
  id: string;
  project_id: string;
  created_at: string;
  action_type: ChangeLogAction | string;
  field_name?: string | null;
  old_value?: string | null;
  new_value?: string | null;
  summary: string;
  details?: any;
}

export interface GlobalChangeLog extends ProjectChangeLog {
  project_title: string;
}

interface ProjectStore {
  projects: Project[];
  loading: boolean;
  keyword: string;
  tagFilter: string;
  sort: ProjectSort;
  priorityFilter: PriorityFilter;
  priorityStats: PriorityStats;

  setKeyword: (keyword: string) => void;
  setTagFilter: (tag: string) => void;
  setSort: (sort: ProjectSort) => void;
  setPriorityFilter: (p: PriorityFilter) => void;
  fetchPriorityStats: () => Promise<void>;
  setProjectPriority: (id: string, priority: ProjectPriority, reason: string) => Promise<void>;
  autoScoreProject: (id: string) => Promise<AutoScoreResponse>;
  downloadAutoScoreCsv: () => Promise<void>;
  fetchProjects: () => Promise<void>;
  completeProject: (id: string) => Promise<void>;
  uploadExcel: (file: File) => Promise<void>;
  importPdfBatch: (files: File[]) => Promise<{ message: string; created: number; updated: number; errors: number; details: any[] }>;
  exportExcel: () => Promise<void>;
  exportAllFilesZip: () => Promise<void>;
  exportProjectFilesZip: (projectId: string) => Promise<void>;
  addTag: (id: string, tag: string) => Promise<void>;
  removeTag: (id: string, tag: string) => Promise<void>;
  updateProject: (id: string, updates: Partial<Project>) => Promise<void>;
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  projects: [],
  loading: false,
  keyword: '',
  tagFilter: '',
  sort: 'latest_update_desc',
  priorityFilter: '',
  priorityStats: { A: 0, B: 0, C: 0, unset: 0, total: 0 },

  setKeyword: (keyword) => {
    set({ keyword });
    get().fetchProjects();
  },

  setTagFilter: (tagFilter) => {
    set({ tagFilter });
    get().fetchProjects();
  },

  setSort: (sort) => {
    set({ sort });
    get().fetchProjects();
  },

  setPriorityFilter: (priorityFilter) => {
    set({ priorityFilter });
    get().fetchProjects();
  },

  fetchPriorityStats: async () => {
    try {
      const res = await axios.get(`${API_URL}/projects/priority/stats`);
      set({ priorityStats: res.data });
    } catch (error) {
      console.error('Failed to fetch priority stats', error);
    }
  },

  setProjectPriority: async (id, priority, reason) => {
    try {
      await axios.put(`${API_URL}/projects/${id}/priority`, { priority, reason });
      // 定级后刷新列表与统计（Tab 栏数字要变）
      await get().fetchProjects();
      await get().fetchPriorityStats();
    } catch (error) {
      console.error('Failed to set project priority', error);
      throw error;
    }
  },

  autoScoreProject: async (id) => {
    const res = await axios.get<AutoScoreResponse>(`${API_URL}/projects/${id}/auto-score`);
    return res.data;
  },

  downloadAutoScoreCsv: async () => {
    try {
      const response = await axios.get(`${API_URL}/projects/priority/auto-score-csv`, {
        responseType: 'blob',
      });
      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ABC自动打分草表_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download auto-score CSV', error);
      throw error;
    }
  },

  fetchProjects: async () => {
    set({ loading: true });
    try {
      const { keyword, tagFilter, sort, priorityFilter } = get();
      const params = new URLSearchParams();

      if (keyword) {
        params.append('keyword', keyword);
      }
      if (tagFilter) params.append('tags', tagFilter);
      if (sort) params.append('sort', sort);
      if (priorityFilter) params.append('priority', priorityFilter);

      const res = await axios.get(`${API_URL}/projects?${params.toString()}`);
      set({ projects: res.data });
    } catch (error) {
      console.error("Failed to fetch projects", error);
    } finally {
      set({ loading: false });
    }
  },

  completeProject: async (id: string) => {
    try {
      await axios.put(`${API_URL}/projects/${id}/complete`);
      await get().fetchProjects();
    } catch (error) {
      console.error("Failed to complete project", error);
    }
  },

  uploadExcel: async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    try {
      await axios.post(`${API_URL}/projects/import`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      await get().fetchProjects();
    } catch (error) {
      console.error("Failed to upload excel", error);
      throw error;
    }
  },

  // 批量导入 PDF 立项申请表
  // 后端会逐个解析 PDF：命中已有项目则按方案① 合并更新字段 + 追加立项申请表文件；
  // 否则新建项目并附加 PDF。
  //
  // Next.js 16 的 rewrites 代理默认只转发 10MB 请求体，39 个 PDF 会被截断导致 500。
  // 所以前端做分批：每批 BATCH_SIZE 个文件分别 POST，再把各批结果合并。
  // 这样做同时也更健壮：某一批失败不会拖垮整次导入。
  importPdfBatch: async (files: File[]) => {
    const BATCH_SIZE = 8;
    const aggregated = {
      message: '',
      created: 0,
      updated: 0,
      errors: 0,
      details: [] as any[],
    };

    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      const chunk = files.slice(i, i + BATCH_SIZE);
      const formData = new FormData();
      chunk.forEach((f) => formData.append('files', f));
      try {
        const response = await axios.post(`${API_URL}/projects/import-pdf`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 300000,
        });
        const res = response.data;
        aggregated.created += res.created ?? 0;
        aggregated.updated += res.updated ?? 0;
        aggregated.errors += res.errors ?? 0;
        aggregated.details.push(...(res.details ?? []));
      } catch (error: any) {
        console.error(`PDF batch ${i / BATCH_SIZE + 1} failed`, error);
        // 整批失败时，把这批每个文件都标记为 error 进入详情
        chunk.forEach((f) => {
          aggregated.errors += 1;
          aggregated.details.push({
            file: f.name,
            action: 'error',
            error: error?.message || '网络或服务器错误',
          });
        });
      }
    }

    aggregated.message = `处理 ${files.length} 个 PDF：新建 ${aggregated.created} 个，更新 ${aggregated.updated} 个，失败 ${aggregated.errors} 个。`;
    await get().fetchProjects();
    return aggregated;
  },

  // 导出项目数据为Excel
  exportExcel: async () => {
    try {
      const { keyword, tagFilter } = get();
      const params = new URLSearchParams();
      if (keyword) params.append('keyword', keyword);
      if (tagFilter) params.append('tags', tagFilter);
      
      const response = await axios.get(`${API_URL}/projects/export/excel?${params.toString()}`, {
        responseType: 'blob'
      });
      
      // 创建下载链接
      const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `项目清单_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to export excel", error);
      throw error;
    }
  },

  // 导出所有项目文件为ZIP
  exportAllFilesZip: async () => {
    try {
      const { tagFilter } = get();
      const params = new URLSearchParams();
      if (tagFilter) params.append('tag', tagFilter);
      
      const response = await axios.get(`${API_URL}/projects/export/zip?${params.toString()}`, {
        responseType: 'blob'
      });
      
      const blob = new Blob([response.data], { type: 'application/zip' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `项目文件包_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to export zip", error);
      throw error;
    }
  },

  // 导出单个项目文件为ZIP
  exportProjectFilesZip: async (projectId: string) => {
    try {
      const response = await axios.get(`${API_URL}/projects/${projectId}/export/zip`, {
        responseType: 'blob'
      });
      
      const blob = new Blob([response.data], { type: 'application/zip' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `项目文件_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to export project zip", error);
      throw error;
    }
  },

  // 添加标签
  addTag: async (id: string, tag: string) => {
    try {
      await axios.post(`${API_URL}/projects/${id}/tags`, { tag });
      await get().fetchProjects();
    } catch (error: any) {
      console.error("Failed to add tag", error);
      throw error;
    }
  },

  // 删除标签
  removeTag: async (id: string, tag: string) => {
    try {
      await axios.delete(`${API_URL}/projects/${id}/tags/${encodeURIComponent(tag)}`);
      await get().fetchProjects();
    } catch (error: any) {
      console.error("Failed to remove tag", error);
      throw error;
    }
  },

  // 更新项目部分字段
  updateProject: async (id: string, updates: Partial<Project>) => {
    try {
      await axios.put(`${API_URL}/projects/${id}`, updates);
      await get().fetchProjects();
    } catch (error) {
      console.error("Failed to update project", error);
      throw error;
    }
  }
}));
