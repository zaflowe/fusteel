"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  Card, CardContent, CardDescription, CardHeader, CardTitle 
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Loader2, LogOut, Folder, User, Users, Clock, 
  Camera, ChevronRight
} from 'lucide-react';
import UpdateTimeline from '@/components/UpdateTimeline';
import ProjectCycleBadge from '@/components/ProjectCycleBadge';

const API_URL = '/api';

interface Project {
  id: string;
  title: string;
  department: string;
  leader?: string;
  participants?: string[];
  status: string;
  tags: string[];
  created_at: string;
  end_date?: string | null;
}

export default function PortalDashboardPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [projectUpdates, setProjectUpdates] = useState<any[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const getPortalToken = () => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('portal_token');
    }
    return null;
  };

  useEffect(() => {
    const token = getPortalToken();
    if (!token) {
      toast.error('请先登录');
      router.push('/portal');
      return;
    }
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    const token = getPortalToken();
    if (!token) return;

    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/portal/projects`, {
        headers: { Authorization: `Bearer ${token}` }
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

  const fetchProjectDetails = async (project: Project) => {
    const token = getPortalToken();
    if (!token) return;

    setSelectedProject(project);
    setDetailsLoading(true);

    try {
      const res = await axios.get(`${API_URL}/portal/projects/${project.id}/updates`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProjectUpdates(res.data);
    } catch (error: any) {
      toast.error('获取项目详情失败');
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('portal_token');
    localStorage.removeItem('portal_project_ids');
    router.push('/portal');
  };

  const backToList = () => {
    setSelectedProject(null);
    setProjectUpdates([]);
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const config: Record<string, { class: string; label: string }> = {
      '实施中': { class: 'bg-blue-500 text-white', label: '实施中' },
      '已完成': { class: 'bg-amber-500 text-white', label: '已完成' },
      '已结项': { class: 'bg-emerald-500 text-white', label: '已结项' },
      '暂停中': { class: 'bg-red-500 text-white', label: '暂停中' }
    };
    const { class: bgClass, label } = config[status] || config['实施中'];
    return <Badge className={`${bgClass}`}>{label}</Badge>;
  };

  // 项目详情视图
  if (selectedProject) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm sticky top-0 z-10">
          <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={backToList}>
                ← 返回列表
              </Button>
              <h1 className="text-lg font-semibold">{selectedProject.title}</h1>
            </div>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-1" /> 退出
            </Button>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-4 py-6">
          {detailsLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-xl">{selectedProject.title}</CardTitle>
                      <CardDescription className="mt-1">
                        {selectedProject.department}
                      </CardDescription>
                    </div>
                    <StatusBadge status={selectedProject.status} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-600">负责人：</span>
                      <span>{selectedProject.leader || '未指定'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-600">创建时间：</span>
                      <span>{new Date(selectedProject.created_at).toLocaleDateString('zh-CN')}</span>
                    </div>
                  </div>
                  
                  {selectedProject.participants && selectedProject.participants.length > 0 && (
                    <div className="flex items-start gap-2 text-sm">
                      <Users className="h-4 w-4 text-gray-400 mt-0.5" />
                      <div>
                        <span className="text-gray-600">参与人员：</span>
                        <span>{selectedProject.participants.join('、')}</span>
                      </div>
                    </div>
                  )}

                  {selectedProject.tags && selectedProject.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      {selectedProject.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Camera className="h-5 w-5" />
                    项目固化记录
                  </CardTitle>
                  <CardDescription>
                    查看项目进展汇报和历史记录
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <UpdateTimeline updates={projectUpdates} />
                </CardContent>
              </Card>
            </div>
          )}
        </main>
      </div>
    );
  }

  // 项目列表视图
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <Folder className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">我的项目</h1>
              <p className="text-sm text-gray-500">查看您参与的项目进展</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-1" /> 退出登录
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : projects.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <Folder className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">暂无关联项目</p>
              <p className="text-sm text-gray-400 mt-1">
                请联系管理员将您添加为项目负责人或参与人员
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {projects.map((project) => (
              <Card 
                key={project.id} 
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => router.push(`/portal/project/${project.id}`)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base line-clamp-1">{project.title}</CardTitle>
                    <StatusBadge status={project.status} />
                  </div>
                  {/* 项目周期胶囊 Badge */}
                  <ProjectCycleBadge createdAt={project.created_at} endDate={project.end_date} compact />
                  <CardDescription className="mt-2 text-xs">{project.department}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-4 text-gray-500">
                      <span className="flex items-center gap-1">
                        <User className="h-3.5 w-3.5" />
                        {project.leader || '未指定'}
                      </span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}