"use client";

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Loader2, Upload, X, Image as ImageIcon } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API_URL = 'http://127.0.0.1:8000/api';

interface UpdateFormProps {
  projectId: string;
  onSuccess?: () => void;
}

interface PreviewImage {
  file: File;
  preview: string;
}

export default function UpdateForm({ projectId, onSuccess }: UpdateFormProps) {
  const [reporterName, setReporterName] = useState('');
  const [content, setContent] = useState('');
  const [images, setImages] = useState<PreviewImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // 拖拽上传处理
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newImages = acceptedFiles.map(file => ({
      file,
      preview: URL.createObjectURL(file)
    }));
    setImages(prev => [...prev, ...newImages]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp']
    },
    multiple: true
  });

  // 删除预览图片
  const removeImage = (index: number) => {
    setImages(prev => {
      const newImages = [...prev];
      URL.revokeObjectURL(newImages[index].preview);
      newImages.splice(index, 1);
      return newImages;
    });
  };

  // 提交表单
  const handleSubmit = async () => {
    // 验证：防止空跑
    if (!reporterName.trim()) {
      toast.error('请填写汇报人姓名');
      return;
    }
    if (!content.trim() && images.length === 0) {
      toast.error('汇报内容和图片不能同时为空');
      return;
    }

    setSubmitting(true);
    try {
      let imageUrls: string[] = [];

      // 第一步：上传图片（如果有）
      if (images.length > 0) {
        setUploading(true);
        const formData = new FormData();
        images.forEach(img => {
          formData.append('files', img.file);
        });

        const uploadRes = await axios.post(`${API_URL}/upload/images`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        imageUrls = uploadRes.data.image_urls;
        setUploading(false);
      }

      // 第二步：提交固化记录
      await axios.post(`${API_URL}/projects/${projectId}/updates`, {
        reporter_name: reporterName.trim(),
        content: content.trim(),
        image_urls: imageUrls
      });

      toast.success('✅ 状态固化成功！');
      
      // 清空表单
      setReporterName('');
      setContent('');
      images.forEach(img => URL.revokeObjectURL(img.preview));
      setImages([]);
      
      onSuccess?.();
    } catch (error: any) {
      // 格式化 FastAPI 错误，防止 Object 导致 React 崩溃
      const detail = error.response?.data?.detail;
      let errorMsg = '提交失败，请重试';
      
      if (Array.isArray(detail)) {
        // FastAPI 验证错误数组格式: [{loc: [...], msg: "...", type: "..."}]
        errorMsg = detail.map((err: any) => `${err.loc?.join('.') || 'field'}: ${err.msg}`).join(', ');
      } else if (typeof detail === 'string') {
        errorMsg = detail;
      } else if (error.message) {
        errorMsg = error.message;
      }
      
      toast.error(errorMsg);
    } finally {
      setSubmitting(false);
      setUploading(false);
    }
  };

  // 判断提交按钮是否禁用
  const isSubmitDisabled = submitting || (!content.trim() && images.length === 0) || !reporterName.trim();

  return (
    <div className="space-y-4 bg-card p-6 rounded-xl border">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-primary" />
        提交进展汇报
      </h3>

      {/* 汇报人姓名 */}
      <div className="space-y-2">
        <Label htmlFor="reporter">汇报人姓名 <span className="text-destructive">*</span></Label>
        <Input
          id="reporter"
          placeholder="请输入您的姓名"
          value={reporterName}
          onChange={(e) => setReporterName(e.target.value)}
          disabled={submitting}
        />
      </div>

      {/* 汇报内容 */}
      <div className="space-y-2">
        <Label htmlFor="content">汇报内容</Label>
        <Textarea
          id="content"
          placeholder="请描述项目当前进展、遇到的问题或下一步计划..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={4}
          disabled={submitting}
        />
      </div>

      {/* 图片上传区域 */}
      <div className="space-y-2">
        <Label>现场照片</Label>
        
        {/* 拖拽区域 */}
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
            isDragActive 
              ? 'border-primary bg-primary/5' 
              : 'border-border hover:border-primary/50 hover:bg-secondary/50'
          } ${submitting ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <input {...getInputProps()} disabled={submitting} />
          <ImageIcon className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {isDragActive ? '松开以上传图片' : '拖拽图片到此处，或点击选择'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            支持 JPG、PNG、GIF、WebP 格式
          </p>
        </div>

        {/* 图片预览 */}
        {images.length > 0 && (
          <div className="grid grid-cols-4 gap-2 mt-3">
            {images.map((img, index) => (
              <div key={index} className="relative aspect-square rounded-lg overflow-hidden border group">
                <img
                  src={img.preview}
                  alt={`Preview ${index + 1}`}
                  className="w-full h-full object-cover"
                />
                {!submitting && (
                  <button
                    onClick={() => removeImage(index)}
                    className="absolute top-1 right-1 p-1 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 提交按钮 */}
      <Button
        onClick={handleSubmit}
        disabled={isSubmitDisabled}
        className="w-full"
        size="lg"
      >
        {submitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {uploading ? '正在上传图片...' : '正在提交...'}
          </>
        ) : (
          <>
            <Upload className="mr-2 h-4 w-4" />
            确认并固化状态
          </>
        )}
      </Button>

      {/* 提示信息 */}
      <p className="text-xs text-muted-foreground text-center">
        固化后的记录不可修改，请确认信息准确
      </p>
    </div>
  );
}