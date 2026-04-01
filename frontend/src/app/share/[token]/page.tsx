"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  Card, CardContent, CardDescription, CardHeader, CardTitle 
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Loader2, Folder, User, Clock, Tag, AlertCircle, ChevronRight
} from 'lucide-react';

const API_URL = '/api';

interface Project {
  id: string;
  title: string;
  department: string;
  leader?: string;
  status: string;
  tags: string[];
  created_at: string;
}

interface TagInfo {
  tag: string;
  project_count: number;
  expires_at: string;
}

export default function SharePage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tagInfo, setTagInfo] = useState<TagInfo | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    if (token) {
      fetchSharedData();
    }
  }, [token]);

  const fetchSharedData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // 并行获取标签信息和项目列表
      const [infoRes, projectsRes] = await Promise.all([
        axios.get(`${API_URL}/share/${token}/tag`),
        axios.get(`${API_URL}/share/${token}/projects`)
      ]);
      
      setTagInfo(infoRes.data);
      setProjects(projectsRes.data);
    } catch (error: any) {
      const detail = error.response?.data?.detail;
      if (detail === '分享链接已过期') {
        setError('该分享链接已过期');
      } else if (detail === '无效的分享链接') {
        setError('无效的分享链接');
      } else {
        setError('加载失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const config: Record<string, { class: string; label: string }> = {
      '实施中': { class: 'bg-blue-500 text-white', label: '实施中' },
      '已完成': { class: 'bg-amber-500 text-white', label: '已完成' },
      '已结项': { class: 'bg-emerald-500 text-white', label: '已结项' }
    };
    const { class: bgClass, label } = config[status] || config['实施中'];
    return <Badge className={`${bgClass}`}>{label}</Badge>;
  };

  // 错误状态
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center py-12">
          <CardContent>
            <AlertCircle className="h-16 w-16 mx-auto text-red-400 mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">无法访问</h2>
            <p className="text-gray-500 mb-6">{error}</p>
            <Button onClick={() => router.push('/')}>
              返回首页
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 加载状态
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航 */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Tag className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-semibold">
                  {tagInfo?.tag || '标签分享'}
                </h1>
                <p className="text-sm text-gray-500">
                  共 {projects.length} 个项目 · 有效期至 {tagInfo?.expires_at ? new Date(tagInfo.expires_at).toLocaleDateString('zh-CN') : '-'}
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => router.push('/')}>
              返回首页
            </Button>
          </div>
        </div>
      </header>

      {/* 项目列表 */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {projects.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <Folder className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">该标签下暂无项目</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {projects.map((project) => (
              <Card key={project.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base line-clamp-1">{project.title}</CardTitle>
                    <StatusBadge status={project.status} />
                  </div>
                  <CardDescription>{project.department}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-4 text-gray-500">
                      <span className="flex items-center gap-1">
                        <User className="h-3.5 w-3.5" />
                        {project.leader || '未指定'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {new Date(project.created_at).toLocaleDateString('zh-CN')}
                      </span>
                    </div>
                  </div>
                  {project.tags && project.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {project.tags.slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                      {project.tags.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{project.tags.length - 3}
                        </Badge>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* 底部提示 */}
      <footer className="max-w-6xl mx-auto px-4 py-6 text-center">
        <p className="text-xs text-gray-400">
          此链接为标签分享链接，仅展示该标签下的公开项目信息
        </p>
      </footer>
    </div>
  );
}