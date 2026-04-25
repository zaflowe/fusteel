"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { User, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API_URL = '/api';

export default function PortalLoginPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  // 登录
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast.error('请输入姓名');
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/portal/auth`, {
        name: name.trim()
      });

      localStorage.setItem('portal_token', res.data.token);
      localStorage.setItem('portal_project_ids', JSON.stringify(res.data.project_ids));
      localStorage.setItem('portal_user_name', res.data.name);
      // 新增：roles + counts，用于 dashboard 三视图 Tab 直接显示数量
      if (res.data.roles) {
        localStorage.setItem('portal_roles', JSON.stringify(res.data.roles));
      }
      if (res.data.counts) {
        localStorage.setItem('portal_role_counts', JSON.stringify(res.data.counts));
      }

      toast.success(`欢迎，${res.data.name}！`);

      // 根据三个角色的数量自动落位到"首个有数据的 Tab"
      const c = res.data.counts || {};
      let defaultTab = 'leader';
      if (!c.leader && c.participant) defaultTab = 'participant';
      else if (!c.leader && !c.participant && c.post_delivery) defaultTab = 'post_delivery';

      router.push(`/portal/dashboard?tab=${defaultTab}`);
    } catch (error: any) {
      const detail = error.response?.data?.detail;
      if (Array.isArray(detail)) {
        const errorMsg = detail.map((err: any) => `${err.loc.join('.')}: ${err.msg}`).join(', ');
        toast.error(`登录失败: ${errorMsg}`);
      } else if (typeof detail === 'string') {
        toast.error(detail);
      } else {
        toast.error(error.message || "登录失败");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-md">
        {/* Logo 区域 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary mb-4 shadow-lg">
            <User className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">项目协同门户</h1>
          <p className="text-gray-600 mt-2">查看您参与的项目进展</p>
        </div>

        <Card className="shadow-xl border-0">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl text-center">外部人员登录</CardTitle>
            <CardDescription className="text-center">
              输入您的姓名即可查看负责的项目
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-6">
              {/* 姓名输入 */}
              <div className="space-y-2">
                <Label htmlFor="name">您的姓名</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="name"
                    type="text"
                    placeholder="请输入姓名"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="pl-10"
                    autoFocus
                  />
                </div>
              </div>

              {/* 登录按钮 */}
              <Button
                type="submit"
                className="w-full"
                disabled={loading || !name.trim()}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    登录中...
                  </>
                ) : (
                  '查看我的项目'
                )}
              </Button>

              {/* 提示信息 */}
              <p className="text-xs text-center text-muted-foreground">
                系统将根据您的姓名匹配项目负责人或参与人员
              </p>
            </form>

          </CardContent>
        </Card>

        {/* 底部版权 */}
        <p className="text-center text-xs text-gray-500 mt-8">
          © 2024 CompanyHub AI · 技改项目智能调度中枢
        </p>
      </div>
    </div>
  );
}