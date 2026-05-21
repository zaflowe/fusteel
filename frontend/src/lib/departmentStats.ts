import axios from 'axios';

const API = '/api';

export type StatsDimension = 'department' | 'site';
export type StatsRange = 'all' | 'year' | 'last_year' | 'custom';

export interface StatsBucket {
  total: number;
  byStatus: Record<string, number>;
  byYear: Record<string, number>;
}

export interface StatsGroup extends StatsBucket {
  key: string;
}

export interface DepartmentStatsResponse {
  dimension: StatsDimension;
  range: StatsRange;
  year?: number | null;
  start?: string | null;
  end?: string | null;
  include_completed: boolean;
  overall: StatsBucket;
  groups: StatsGroup[];
}

export interface DepartmentProjectItem {
  id: string;
  title: string;
  status: string;
  leader?: string;
  department?: string;
  project_code?: string;
  created_at?: string;
  end_date?: string;
  groups: string[];
}

export interface StatsQuery {
  dimension: StatsDimension;
  range: StatsRange;
  year?: number;
  start?: string;
  end?: string;
  include_completed: boolean;
}

export function buildStatsParams(q: StatsQuery): Record<string, string | number | boolean> {
  const p: Record<string, string | number | boolean> = {
    dimension: q.dimension,
    range: q.range,
    include_completed: q.include_completed,
  };
  if (q.range === 'year' && q.year) p.year = q.year;
  if (q.range === 'custom' && q.start && q.end) {
    p.start = q.start;
    p.end = q.end;
  }
  return p;
}

export async function fetchDepartmentStats(q: StatsQuery): Promise<DepartmentStatsResponse> {
  const res = await axios.get<DepartmentStatsResponse>(`${API}/stats/departments`, {
    params: buildStatsParams(q),
  });
  return res.data;
}

export async function fetchGroupProjects(
  group: string,
  q: StatsQuery,
): Promise<DepartmentProjectItem[]> {
  const res = await axios.get<DepartmentProjectItem[]>(`${API}/stats/departments/projects`, {
    params: { group, ...buildStatsParams(q) },
  });
  return res.data;
}

export function exportStatsExcelUrl(q: StatsQuery): string {
  const params = new URLSearchParams();
  Object.entries(buildStatsParams(q)).forEach(([k, v]) => {
    params.set(k, String(v));
  });
  return `${API}/stats/departments/export.xlsx?${params.toString()}`;
}

export const STATUS_COLORS: Record<string, string> = {
  '实施中': '#3b82f6',
  '已完成': '#f59e0b',
  '已结项': '#10b981',
  '暂停中': '#ef4444',
};

export const STATUS_ORDER = ['实施中', '已完成', '已结项', '暂停中'] as const;

/** 完成率 = 已结项 / 总数（百分比，保留 0 位小数） */
export function completionRate(total: number, byStatus: Record<string, number>): number {
  if (!total) return 0;
  return Math.round(((byStatus['已结项'] ?? 0) / total) * 100);
}
