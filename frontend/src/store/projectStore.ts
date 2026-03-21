import { create } from 'zustand';
import axios from 'axios';

const API_URL = '/api';

export type ProjectStatus = '实施中' | '待结项' | '已完成';

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
  project_code?: string;  // 项目编号，如 JGCX-2026-014
  title: string;
  department?: string;
  leader?: string;
  participants: string[];
  tags: string[];
  status: ProjectStatus;
  created_at: string;
  end_date?: string;  // 结项时间
  delay_reason?: string;  // 延期原因
  files: ProjectFile[];
  milestones: Milestone[];
}

export interface ProjectDelayHistory {
  id: string;
  project_id: string;
  old_end_date?: string;
  new_end_date: string;
  reason: string;
  changed_by: string;
  created_at: string;
}

interface ProjectStore {
  projects: Project[];
  loading: boolean;
  keyword: string;
  tagFilter: string;
  
  setKeyword: (keyword: string) => void;
  setTagFilter: (tag: string) => void;
  fetchProjects: () => Promise<void>;
  completeProject: (id: string) => Promise<void>;
  uploadExcel: (file: File) => Promise<void>;
  exportExcel: () => Promise<void>;
  exportAllFilesZip: () => Promise<void>;
  exportProjectFilesZip: (projectId: string) => Promise<void>;
  addTag: (id: string, tag: string) => Promise<void>;
  removeTag: (id: string, tag: string) => Promise<void>;
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  projects: [],
  loading: false,
  keyword: '',
  tagFilter: '',

  setKeyword: (keyword) => {
    set({ keyword });
    get().fetchProjects();
  },
  
  setTagFilter: (tagFilter) => {
    set({ tagFilter });
    get().fetchProjects();
  },

  fetchProjects: async () => {
    set({ loading: true });
    try {
      const { keyword, tagFilter } = get();
      const params = new URLSearchParams();
      
      // 统一将搜索词作为 keyword 参数，由后端统一处理标题和标签搜索
      if (keyword) {
        params.append('keyword', keyword);
      }
      
      if (tagFilter) params.append('tags', tagFilter);
      
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
  }
}));
