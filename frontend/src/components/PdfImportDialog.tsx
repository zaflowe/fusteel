"use client";

import { useState, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  FileUp,
  FileText,
  Trash2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  PlusCircle,
  XCircle,
} from 'lucide-react';
import { useProjectStore } from '@/store/projectStore';

interface PdfImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ImportResultDetail {
  file: string;
  action: 'created' | 'updated' | 'error';
  project_id?: string;
  project_title?: string;
  matched_to?: string;
  error?: string;
}

interface ImportResult {
  message: string;
  created: number;
  updated: number;
  errors: number;
  details: ImportResultDetail[];
}

export default function PdfImportDialog({ open, onOpenChange }: PdfImportDialogProps) {
  const { importPdfBatch } = useProjectStore();
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setFiles([]);
    setResult(null);
    setUploading(false);
  };

  const handleClose = (next: boolean) => {
    if (uploading) return; // 上传中禁止关闭
    if (!next) resetState();
    onOpenChange(next);
  };

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const arr = Array.from(incoming).filter(
      (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
    );
    if (arr.length === 0) {
      toast.error('只支持 PDF 文件');
      return;
    }
    setFiles((prev) => {
      const map = new Map<string, File>();
      [...prev, ...arr].forEach((f) => map.set(`${f.name}_${f.size}`, f));
      return Array.from(map.values());
    });
  }, []);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) addFiles(e.target.files);
    if (inputRef.current) inputRef.current.value = '';
  };

  const removeFile = (idx: number) =>
    setFiles((prev) => prev.filter((_, i) => i !== idx));

  const handleUpload = async () => {
    if (files.length === 0) {
      toast.error('请先选择 PDF 文件');
      return;
    }
    setUploading(true);
    setResult(null);
    try {
      const res = await importPdfBatch(files);
      setResult(res);
      const msg = `新建 ${res.created} 个 · 更新 ${res.updated} 个 · 失败 ${res.errors} 个`;
      if (res.errors > 0) {
        toast.warning(`PDF 导入完成（${msg}）`);
      } else {
        toast.success(`PDF 导入成功！${msg}`);
      }
    } catch (err: any) {
      const detail = err?.response?.data?.detail || err?.message || '未知错误';
      toast.error(`导入失败：${detail}`);
    } finally {
      setUploading(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileUp className="h-5 w-5 text-primary" />
            批量导入 PDF 立项申请表
          </DialogTitle>
          <DialogDescription>
            支持 Q/FG G0286-2022 格式 PDF。系统按项目名称自动匹配已有项目（≥80% 相似度）：
            命中则把 PDF 作为立项申请表附加并补全空字段；未命中则新建项目。
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mx-1 px-1 space-y-4">
          {/* 上传区 */}
          {!result && (
            <>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
                className={`
                  border-2 border-dashed rounded-xl px-6 py-10 text-center cursor-pointer
                  transition-colors
                  ${
                    isDragging
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50 hover:bg-muted/30'
                  }
                `}
              >
                <FileUp className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm font-medium">
                  拖拽 PDF 文件到此，或点击选择
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  支持同时选择多个文件 · 每个 PDF 对应一个项目
                </p>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  multiple
                  className="hidden"
                  onChange={handleFileInput}
                />
              </div>

              {files.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium">
                      已选择 {files.length} 个文件
                    </h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => setFiles([])}
                      disabled={uploading}
                    >
                      清空列表
                    </Button>
                  </div>
                  <div className="border rounded-lg divide-y max-h-60 overflow-y-auto">
                    {files.map((f, idx) => (
                      <div
                        key={`${f.name}_${idx}`}
                        className="flex items-center gap-3 px-3 py-2 text-sm"
                      >
                        <FileText className="h-4 w-4 text-red-500 shrink-0" />
                        <span className="flex-1 truncate" title={f.name}>
                          {f.name}
                        </span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {formatSize(f.size)}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="h-7 w-7 text-muted-foreground hover:text-red-500"
                          onClick={() => removeFile(idx)}
                          disabled={uploading}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* 结果面板 */}
          {result && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg border bg-emerald-500/5 border-emerald-500/20 p-3 text-center">
                  <div className="flex items-center justify-center gap-1 text-emerald-600 text-xs font-medium">
                    <PlusCircle className="h-3.5 w-3.5" /> 新建
                  </div>
                  <div className="text-2xl font-semibold text-emerald-600 mt-1">
                    {result.created}
                  </div>
                </div>
                <div className="rounded-lg border bg-blue-500/5 border-blue-500/20 p-3 text-center">
                  <div className="flex items-center justify-center gap-1 text-blue-600 text-xs font-medium">
                    <RefreshCw className="h-3.5 w-3.5" /> 更新
                  </div>
                  <div className="text-2xl font-semibold text-blue-600 mt-1">
                    {result.updated}
                  </div>
                </div>
                <div className="rounded-lg border bg-red-500/5 border-red-500/20 p-3 text-center">
                  <div className="flex items-center justify-center gap-1 text-red-600 text-xs font-medium">
                    <AlertCircle className="h-3.5 w-3.5" /> 失败
                  </div>
                  <div className="text-2xl font-semibold text-red-600 mt-1">
                    {result.errors}
                  </div>
                </div>
              </div>

              <div className="border rounded-lg divide-y max-h-72 overflow-y-auto">
                {result.details.map((d, i) => (
                  <div key={i} className="px-3 py-2 text-xs flex items-start gap-2">
                    {d.action === 'created' && (
                      <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 shrink-0">
                        新建
                      </Badge>
                    )}
                    {d.action === 'updated' && (
                      <Badge className="bg-blue-500/15 text-blue-600 border-blue-500/30 shrink-0">
                        更新
                      </Badge>
                    )}
                    {d.action === 'error' && (
                      <Badge className="bg-red-500/15 text-red-600 border-red-500/30 shrink-0">
                        失败
                      </Badge>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-medium">
                        {d.project_title || d.file}
                      </div>
                      <div className="text-muted-foreground truncate">
                        {d.action === 'error'
                          ? d.error
                          : d.matched_to
                          ? `匹配到已有项目：${d.matched_to}`
                          : `源文件：${d.file}`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="mt-2">
          {!result ? (
            <>
              <Button
                variant="outline"
                onClick={() => handleClose(false)}
                disabled={uploading}
              >
                取消
              </Button>
              <Button
                onClick={handleUpload}
                disabled={uploading || files.length === 0}
                className="min-w-[120px]"
              >
                {uploading ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    解析中…
                  </>
                ) : (
                  <>
                    <FileUp className="h-4 w-4 mr-2" />
                    开始导入 ({files.length})
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={resetState}>
                继续导入
              </Button>
              <Button onClick={() => handleClose(false)}>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                完成
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
