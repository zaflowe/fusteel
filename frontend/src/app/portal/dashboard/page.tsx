"use client";

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Loader2, LogOut, Folder, User, ChevronRight,
  Briefcase, Users, HandshakeIcon,
} from 'lucide-react';
import ProjectCycleBadge from '@/components/ProjectCycleBadge';
import LatestUpdateLine from '@/components/LatestUpdateLine';

const API_URL = '/api';

// 门户项目卡片所需最小字段集（后端 ProjectResponse 的子集）
interface PortalProject {
  id: string;
  title: string;
  department?: string;
  leader?: string;
  participants?: string[];
  post_delivery_person?: string | null;
  status: string;
  tags: string[];
  created_at: string;
  end_date?: string | null;
  latest_update_at?: string | null;
  latest_update_summary?: string | null;
  latest_update_reporter?: string | null;
}

type PortalRole = 'leader' | 'participant' | 'post_delivery';

interface PortalRoleCounts {
  leader?: number;
  participant?: number;
  post_delivery?: number;
  total?: number;
}

// 三视图 Tab 配置
const TAB_CONFIG: {
  value: PortalRole;
  label: string;
  icon: typeof User;
  emptyHint: string;
}[] = [
  {
    value: 'leader',
    label: '我负责的',
    icon: Briefcase,
    emptyHint: '您目前不是任何项目的负责人',
  },
  {
    value: 'participant',
    label: '我参与的',
    icon: Users,
    emptyHint: '您目前不是任何项目的参与人员（已自动剔除您作为负责人的项目）',
  },
  {
    value: 'post_delivery',
    label: '我运维的',
    icon: HandshakeIcon,
    emptyHint: '您目前不是任何项目的"交付后负责人"',
  },
];

function PortalDashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [projects, setProjects] = useState<PortalProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState<string>('');
  const [counts, setCounts] = useState<PortalRoleCounts>({});

  // Tab：从 URL 读，没有就默认 leader
  const urlTab = searchParams.get('tab') as PortalRole | null;
  const [tab, setTab] = useState<PortalRole>(urlTab && ['leader', 'participant', 'post_delivery'].includes(urlTab) ? urlTab : 'leader');

  const getPortalToken = () => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('portal_token');
    }
    return null;
  };

  // 初始化：读登录信息
  useEffect(() => {
    const token = getPortalToken();
    if (!token) {
      toast.error('请先登录');
      router.push('/portal');
      return;
    }
    if (typeof window !== 'undefined') {
      setUserName(localStorage.getItem('portal_user_name') || '');
      try {
        const c = localStorage.getItem('portal_role_counts');
        if (c) setCounts(JSON.parse(c));
      } catch {
        setCounts({});
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 每次 Tab 切换都重新请求后端，按 role 过滤
  useEffect(() => {
    const token = getPortalToken();
    if (!token) return;
    fetchProjects(tab, token);
    // 把 tab 同步进 URL，方便外部用户分享链接
    const current = searchParams.get('tab');
    if (current !== tab) {
      const sp = new URLSearchParams(searchParams.toString());
      sp.set('tab', tab);
      router.replace(`/portal/dashboard?${sp.toString()}`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const fetchProjects = async (role: PortalRole, token: string) => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/portal/projects`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { role, sort: 'latest_update_desc' },
      });
      setProjects(res.data);
    } catch (error: any) {
      if (error.response?.status === 401) {
        toast.error('登录已过期，请重新登录');
        handleLogout();
      } else {
        toast.error('获取项目列表失败');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('portal_token');
    localStorage.removeItem('portal_project_ids');
    localStorage.removeItem('portal_user_name');
    localStorage.removeItem('portal_roles');
    localStorage.removeItem('portal_role_counts');
    router.push('/portal');
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const config: Record<string, { class: string; label: string }> = {
      '实施中': { class: 'bg-blue-500 text-white', label: '实施中' },
      '已完成': { class: 'bg-amber-500 text-white', label: '已完成' },
      '已结项': { class: 'bg-emerald-500 text-white', label: '已结项' },
      '暂停中': { class: 'bg-red-500 text-white', label: '暂停中' },
    };
    const { class: bgClass, label } = config[status] || config['实施中'];
    return <Badge className={`${bgClass}`}>{label}</Badge>;
  };

  const totalCount = useMemo(() => {
    return (counts.leader ?? 0) + (counts.participant ?? 0) + (counts.post_delivery ?? 0);
  }, [counts]);

  const currentTabEmptyHint =
    TAB_CONFIG.find(t => t.value === tab)?.emptyHint || '暂无关联项目';

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <Folder className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">
                {userName ? `${userName} 的项目视图` : '我的项目'}
              </h1>
              <p className="text-sm text-gray-500">
                共 {totalCount} 个与您相关的项目
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-1" /> 退出登录
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-4">
        {/* 三视图 Tab 栏 */}
        <Tabs value={tab} onValueChange={(v) => setTab(v as PortalRole)}>
          <TabsList className="grid grid-cols-3 w-full max-w-xl">
            {TAB_CONFIG.map(cfg => {
              const Icon = cfg.icon;
              const n = counts[cfg.value] ?? 0;
              return (
                <TabsTrigger
                  key={cfg.value}
                  value={cfg.value}
                  className="flex items-center gap-1.5 text-xs sm:text-sm"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {cfg.label}
                  <Badge variant="secondary" className="ml-1 h-5 min-w-[22px] px-1.5 text-[10px]">
                    {n}
                  </Badge>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>

        {/* 项目卡片列表 */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : projects.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <Folder className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">{currentTabEmptyHint}</p>
              <p className="text-sm text-gray-400 mt-1">
                若信息有误，请联系技术改造办
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {projects.map((project) => (
              <Card
                key={project.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => router.push(`/portal/project/${project.id}?tab=${tab}`)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base line-clamp-1">{project.title}</CardTitle>
                    <StatusBadge status={project.status} />
                  </div>
                  <ProjectCycleBadge createdAt={project.created_at} endDate={project.end_date} compact />
                  <CardDescription className="mt-2 text-xs">{project.department}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-4 text-gray-500">
                      <span className="flex items-center gap-1">
                        <User className="h-3.5 w-3.5" />
                        {tab === 'post_delivery'
                          ? (project.post_delivery_person || '未指定')
                          : (project.leader || '未指定')}
                      </span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  </div>

                  {/* 最近一次项目固化 */}
                  <LatestUpdateLine
                    latestAt={project.latest_update_at}
                    summary={project.latest_update_summary}
                    reporter={project.latest_update_reporter}
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default function PortalDashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <PortalDashboardContent />
    </Suspense>
  );
}
