"use client";

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import axios from 'axios';
import { Save, Plus, Trash2, CheckCircle, Sparkles, Eye, EyeOff } from 'lucide-react';

const API_URL = '/api';

interface AIConfig {
  id: string;
  name: string;
  base_url: string;
  model: string;
  temperature: string;
  max_tokens: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function AIConfigPage() {
  const [configs, setConfigs] = useState<AIConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  
  // 表单状态
  const [formData, setFormData] = useState({
    name: '通义千问配置',
    base_url: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    api_key: '',
    model: 'qwen-max',
    temperature: '0.7',
    max_tokens: 2048,
  });

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    try {
      const res = await axios.get(`${API_URL}/ai-configs`);
      setConfigs(res.data);
    } catch (error) {
      console.error('Failed to fetch configs', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${API_URL}/ai-configs`, formData);
      toast.success('AI配置创建成功');
      fetchConfigs();
      // 重置表单
      setFormData({
        name: '通义千问配置',
        base_url: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        api_key: '',
        model: 'qwen-max',
        temperature: '0.7',
        max_tokens: 2048,
      });
    } catch (error) {
      toast.error('创建失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const activateConfig = async (id: string) => {
    try {
      await axios.post(`${API_URL}/ai-configs/${id}/activate`);
      toast.success('配置已激活');
      fetchConfigs();
    } catch (error) {
      toast.error('激活失败');
    }
  };

  const deleteConfig = async (id: string) => {
    if (!confirm('确定要删除此配置吗？')) return;
    try {
      await axios.delete(`${API_URL}/ai-configs/${id}`);
      toast.success('配置已删除');
      fetchConfigs();
    } catch (error) {
      toast.error('删除失败');
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Sparkles className="h-8 w-8 text-purple-500" />
          AI 引擎配置中心
        </h1>
        <p className="text-muted-foreground mt-2">
          配置阿里云通义千问 (Qwen) API 参数，兼容 OpenAI 接口规范
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* 配置表单 */}
        <Card>
          <CardHeader>
            <CardTitle>新建配置</CardTitle>
            <CardDescription>添加新的 AI 引擎配置</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">配置名称</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="如：通义千问-生产环境"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="base_url">Base URL</Label>
                <Input
                  id="base_url"
                  value={formData.base_url}
                  onChange={(e) => setFormData({...formData, base_url: e.target.value})}
                  placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  通义千问兼容模式：https://dashscope.aliyuncs.com/compatible-mode/v1
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="api_key">API Key</Label>
                <div className="relative">
                  <Input
                    id="api_key"
                    type={showApiKey ? "text" : "password"}
                    value={formData.api_key}
                    onChange={(e) => setFormData({...formData, api_key: e.target.value})}
                    placeholder="sk-xxxxxxxx"
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-1/2 -translate-y-1/2"
                    onClick={() => setShowApiKey(!showApiKey)}
                  >
                    {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="model">模型名称</Label>
                <Input
                  id="model"
                  value={formData.model}
                  onChange={(e) => setFormData({...formData, model: e.target.value})}
                  placeholder="qwen-max"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  可选：qwen-max, qwen-plus, qwen-turbo
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="temperature">Temperature</Label>
                  <Input
                    id="temperature"
                    value={formData.temperature}
                    onChange={(e) => setFormData({...formData, temperature: e.target.value})}
                    placeholder="0.7"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max_tokens">Max Tokens</Label>
                  <Input
                    id="max_tokens"
                    type="number"
                    value={formData.max_tokens}
                    onChange={(e) => setFormData({...formData, max_tokens: parseInt(e.target.value)})}
                    placeholder="2048"
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                <Plus className="h-4 w-4 mr-2" />
                {loading ? '创建中...' : '创建配置'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* 配置列表 */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">已有配置</h3>
          {configs.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                暂无配置，请添加
              </CardContent>
            </Card>
          ) : (
            configs.map((config) => (
              <Card key={config.id} className={config.is_active ? 'border-purple-500 border-2' : ''}>
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{config.name}</CardTitle>
                      <CardDescription className="text-xs">
                        {config.base_url}
                      </CardDescription>
                    </div>
                    {config.is_active ? (
                      <Badge className="bg-purple-500">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        已启用
                      </Badge>
                    ) : (
                      <Badge variant="outline">未启用</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="text-sm space-y-1 text-muted-foreground">
                    <p>模型：{config.model}</p>
                    <p>Temperature：{config.temperature}</p>
                    <p>Max Tokens：{config.max_tokens}</p>
                  </div>
                  <div className="flex gap-2 mt-4">
                    {!config.is_active && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => activateConfig(config.id)}
                      >
                        启用
                      </Button>
                    )}
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteConfig(config.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}