"use client";

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Gauge, Loader2, Sparkles, ShieldAlert, Info } from 'lucide-react';
import { toast } from 'sonner';
import PriorityBadge from '@/components/PriorityBadge';
import {
  useProjectStore,
  ProjectPriority,
  AutoScoreResponse,
  Project,
} from '@/store/projectStore';

/**
 * 项目详情页的 "ABC 定级" 板块。
 * - 显示当前等级、上次定级理由/时间
 * - 允许选择 A/B/C 并填理由保存（强制留痕）
 * - 可一键跑自动打分，拿到建议后再决定是否采纳
 */
export interface PrioritySectionProps {
  project: Project;
  /** 保存成功后的回调（由详情页刷新 project 对象使用） */
  onSaved?: () => Promise<void> | void;
}

const LEVEL_OPTIONS: { value: ProjectPriority; label: string; desc: string }[] = [
  { value: 'A', label: 'A 类（核心）', desc: '每周盯进度，异常立即弹窗' },
  { value: 'B', label: 'B 类（重点）', desc: '每两周盯一次，异常升级' },
  { value: 'C', label: 'C 类（一般）', desc: '每月扫一次，出问题再处理' },
];

export default function PrioritySection({ project, onSaved }: PrioritySectionProps) {
  const { setProjectPriority, autoScoreProject } = useProjectStore();

  const [showModal, setShowModal] = useState(false);
  const [picked, setPicked] = useState<ProjectPriority | ''>('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const [scoring, setScoring] = useState(false);
  const [score, setScore] = useState<AutoScoreResponse | null>(null);

  const openModal = () => {
    setPicked(project.priority || '');
    setReason('');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!picked) {
      toast.error('请先选择 A/B/C');
      return;
    }
    if (reason.trim().length < 2) {
      toast.error('请填写定级 / 升降级理由（至少 2 字）');
      return;
    }
    setSaving(true);
    try {
      await setProjectPriority(project.id, picked, reason.trim());
      toast.success(`已定级为 ${picked} 类`);
      setShowModal(false);
      if (onSaved) await onSaved();
    } catch (e) {
      toast.error('保存失败，请稍后重试');
    } finally {
      setSaving(false);
    }
  };

  const handleAutoScore = async () => {
    setScoring(true);
    try {
      const res = await autoScoreProject(project.id);
      setScore(res);
    } catch (e) {
      toast.error('自动打分失败');
    } finally {
      setScoring(false);
    }
  };

  const applySuggestion = () => {
    if (!score) return;
    setPicked(score.suggested_priority);
    const hard = score.hard_hit ? `硬指标命中：${score.hard_hit}；` : '';
    setReason(`${hard}自动打分 ${score.total_score}/12（${score.breakdown.map(d => `${d.dim}${d.score}`).join('，')}）`);
    setShowModal(true);
  };

  return (
    <Card className="border-2 border-fuchsia-500/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Gauge className="h-5 w-5 text-fuchsia-500" />
            项目定级
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleAutoScore}
              disabled={scoring}
              title="按 5 维度自动打分，返回建议等级（不直接落库）"
            >
              {scoring
                ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />打分中</>
                : <><Sparkles className="h-3.5 w-3.5 mr-1" />自动打分建议</>}
            </Button>
            <Button size="sm" onClick={openModal}>
              {project.priority ? '升 / 降级' : '立即定级'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* 当前等级信息条 */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">当前等级：</span>
            <PriorityBadge priority={project.priority} size="md" showLabel />
          </div>
          {project.priority_score != null && (
            <div className="text-xs text-muted-foreground">
              最近自动分：<span className="font-semibold text-foreground">{project.priority_score}/12</span>
            </div>
          )}
          {project.priority_set_at && (
            <div className="text-xs text-muted-foreground">
              定级时间：{new Date(project.priority_set_at).toLocaleString('zh-CN')}
            </div>
          )}
        </div>
        {project.priority_reason && (
          <div className="text-xs text-muted-foreground bg-muted/50 rounded p-2 border-l-2 border-fuchsia-500/40">
            <span className="font-medium text-foreground">定级理由：</span>
            {project.priority_reason}
          </div>
        )}

        {/* 自动打分结果卡 */}
        {score && (
          <div className="mt-3 rounded-lg border-2 border-dashed border-fuchsia-300 bg-fuchsia-50/50 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-fuchsia-600" />
                <span className="font-medium">自动建议等级：</span>
                <PriorityBadge priority={score.suggested_priority} size="md" showLabel />
                <span className="text-xs text-muted-foreground">
                  总分 {score.total_score}/12
                </span>
              </div>
              <Button size="sm" variant="outline" onClick={applySuggestion}>
                采纳建议并填理由
              </Button>
            </div>

            {score.hard_hit && (
              <div className="flex items-start gap-1.5 text-xs text-red-600">
                <ShieldAlert className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                <span>命中硬指标：{score.hard_hit}（直接判 A）</span>
              </div>
            )}

            {/* 维度明细 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
              {score.breakdown.map(d => (
                <div key={d.dim} className="flex items-center justify-between text-xs bg-white rounded px-2 py-1 border">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-medium">{d.dim}</span>
                    {d.manual && (
                      <Badge variant="outline" className="text-[10px] h-4 px-1 py-0 border-amber-400 text-amber-600">
                        人工确认
                      </Badge>
                    )}
                    <span className="text-muted-foreground truncate">· {d.value}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    <span className="text-muted-foreground hidden md:inline">{d.rationale}</span>
                    <span className="font-bold text-fuchsia-600">{d.score}</span>
                  </div>
                </div>
              ))}
            </div>

            {score.note && (
              <div className="flex items-start gap-1.5 text-[11px] text-amber-600">
                <Info className="h-3 w-3 flex-shrink-0 mt-0.5" />
                <span>{score.note}</span>
              </div>
            )}
          </div>
        )}

        {/* 从未定级时的提示 */}
        {!project.priority && !score && (
          <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
            本项目尚未评级。建议先点「自动打分建议」，再确认保存。
          </div>
        )}
      </CardContent>

      {/* 定级/升降级 弹窗 */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>设置项目 ABC 等级</DialogTitle>
            {/* 说明文字按用户要求精简：弹窗只保留标题 + 选项 + 理由 */}
            <DialogDescription className="sr-only">设置项目 ABC 等级</DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-1">
            <div className="space-y-2">
              {LEVEL_OPTIONS.map(opt => {
                const active = picked === opt.value;
                return (
                  <button
                    type="button"
                    key={opt.value}
                    onClick={() => setPicked(opt.value)}
                    className={`w-full text-left border-2 rounded-lg p-3 transition-all ${
                      active
                        ? 'border-fuchsia-500 bg-fuchsia-50 shadow-sm'
                        : 'border-border hover:border-fuchsia-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <PriorityBadge priority={opt.value} size="md" />
                      <span className="font-medium">{opt.label}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">{opt.desc}</div>
                  </button>
                );
              })}
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">
                定级 / 升降级理由 <span className="text-red-500">*</span>
              </label>
              <Textarea
                rows={3}
                value={reason}
                onChange={e => setReason(e.target.value)}
              />
              <div className="text-[11px] text-muted-foreground mt-1">
                理由会写进干预动作时间轴，之后可随时回溯。
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)} disabled={saving}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />保存中</> : '保存定级'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
