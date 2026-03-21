"use client";

import React, { useRef, useState } from 'react';
import { UploadCloud, File as FileIcon, Download, RefreshCw, Loader2, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';

export type FileType = 'application' | 'ppt' | 'free_resource';

export interface ProjectFile {
  id: string;
  project_id: string;
  file_type: FileType;
  storage_path: string;
  original_name: string;
  file_size: number;
  uploaded_by: string;
  uploaded_at: string;
}

interface FilePoolSectionProps {
  files: ProjectFile[];
  uploadingType: FileType | null;
  onUpload: (fileType: FileType, file: File) => void;
  onDownload: (fileId: string, originalName: string) => void;
  onDelete: (fileId: string) => void;
  /** 控制外部人员是否只有查看/下载权限，没有上传/删除/覆盖权限 */
  readonly?: boolean; 
}

interface FileCardProps {
  title: string;
  fileType: FileType;
  files: ProjectFile[];
  accept: string;
  uploading: boolean;
  onUpload: (fileType: FileType, file: File) => void;
  onDownload: (fileId: string, originalName: string) => void;
  onDelete: (fileId: string) => void;
  allowMultiple: boolean;
  readonly: boolean;
}

function FileCard({
  title, fileType, files, accept, uploading, onUpload, onDownload, onDelete, allowMultiple, readonly
}: FileCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(fileType, file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (readonly) return;
    const file = e.dataTransfer.files?.[0];
    if (file) {
      onUpload(fileType, file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!readonly) setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const triggerUpload = () => {
    if (!readonly && !uploading) {
      fileInputRef.current?.click();
    }
  };

  // 状态 A: 未上传
  if (files.length === 0) {
    return (
      <Card className="flex flex-col h-full overflow-hidden border shadow-sm">
        <div className="bg-muted px-4 py-3 border-b font-medium text-sm">
          {title}
        </div>
        <div 
          className={`flex-1 p-6 flex flex-col items-center justify-center transition-colors min-h-[200px]
            ${readonly ? 'bg-gray-50' : 'cursor-pointer hover:bg-secondary/30'}
            ${isDragOver ? 'bg-primary/5 border-primary border-2 border-dashed' : 'border-2 border-dashed border-transparent'}
          `}
          onClick={triggerUpload}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <input
            type="file"
            ref={fileInputRef}
            accept={accept}
            className="hidden"
            onChange={handleFileChange}
          />
          {uploading ? (
            <div className="flex flex-col items-center gap-2 text-primary">
              <Loader2 className="h-10 w-10 animate-spin" />
              <span className="text-sm font-medium">正在上传...</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <UploadCloud className="h-12 w-12 text-gray-400" />
              <div className="text-center">
                <p className="font-medium text-gray-600">
                  {readonly ? '暂无文件' : `点击或拖拽上传`}
                </p>
                {!readonly && (
                  <p className="text-sm mt-1">{title}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </Card>
    );
  }

  // 状态 B: 已上传
  return (
    <Card className="flex flex-col h-full overflow-hidden border shadow-sm top-0 relative">
      <div className="bg-muted px-4 py-3 border-b font-medium text-sm flex justify-between items-center">
        <span>{title} {allowMultiple && files.length > 1 && `(${files.length})`}</span>
      </div>
      
      <div className="flex-1 p-0 flex flex-col bg-slate-50 relative">
        <input
          type="file"
          ref={fileInputRef}
          accept={accept}
          className="hidden"
          onChange={handleFileChange}
        />
        
        {uploading && (
          <div className="absolute inset-0 bg-white/80 z-10 flex flex-col items-center justify-center pointer-events-none">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
            <span className="text-sm font-medium text-primary">正在上传...</span>
          </div>
        )}

        {/* 覆盖/新增模式的上传框被隐藏，只通过按钮触发 */}
        
        <div className="flex-1 overflow-y-auto max-h-[260px] p-4 space-y-3">
          {files.map(file => (
            <div key={file.id} className="bg-white border rounded-lg p-3 shadow-sm hover:shadow transition-shadow">
              <div className="flex items-center justify-center py-4">
                <FileIcon className="h-12 w-12 text-blue-500 mb-2" />
              </div>
              <div className="text-center mb-4">
                <p className="font-medium text-sm text-gray-800 line-clamp-2" title={file.original_name}>
                  {file.original_name}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {(file.file_size / 1024 / 1024).toFixed(2)} MB • {file.uploaded_by}
                </p>
              </div>
              
              <div className="flex items-center justify-center gap-2 pt-2 border-t border-gray-100">
                <button 
                  className="flex-1 text-xs font-medium text-blue-600 hover:text-blue-800 flex items-center justify-center gap-1 py-1.5 hover:bg-blue-50 rounded transition-colors"
                  onClick={(e) => { e.stopPropagation(); onDownload(file.id, file.original_name); }}
                >
                  <Download className="h-3.5 w-3.5" />
                  下载查看
                </button>
                
                {!readonly && (
                  <>
                    {!allowMultiple && (
                      <button 
                        className="flex-1 text-xs font-medium text-green-600 hover:text-green-800 flex items-center justify-center gap-1 py-1.5 hover:bg-green-50 rounded transition-colors"
                        onClick={(e) => { e.stopPropagation(); triggerUpload(); }}
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        覆盖
                      </button>
                    )}
                    {allowMultiple && (
                      <button 
                        className="flex-none text-xs font-medium text-red-600 hover:text-red-800 flex items-center justify-center gap-1 py-1.5 px-3 hover:bg-red-50 rounded transition-colors"
                        onClick={(e) => { e.stopPropagation(); onDelete(file.id); }}
                        title="删除此文件"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
          
          {allowMultiple && !readonly && (
            <button 
              className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2"
              onClick={triggerUpload}
            >
              <UploadCloud className="h-4 w-4" />
              继续上传文件
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}

/**
 * 项目资料池 UI 组件
 * 包含立项申请表、结项 PPT、自由资料池 3个卡片结构
 */
export default function FilePoolSection({ 
  files, uploadingType, onUpload, onDownload, onDelete, readonly = false 
}: FilePoolSectionProps) {
  const applicationFiles = files.filter(f => f.file_type === 'application');
  const pptFiles = files.filter(f => f.file_type === 'ppt');
  const freeFiles = files.filter(f => f.file_type === 'free_resource');

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <FileCard
        title="立项申请表"
        fileType="application"
        files={applicationFiles}
        accept=".pdf"
        uploading={uploadingType === 'application'}
        onUpload={onUpload}
        onDownload={onDownload}
        onDelete={onDelete}
        allowMultiple={false}
        readonly={readonly}
      />
      <FileCard
        title="结项 PPT"
        fileType="ppt"
        files={pptFiles}
        accept=".ppt,.pptx"
        uploading={uploadingType === 'ppt'}
        onUpload={onUpload}
        onDownload={onDownload}
        onDelete={onDelete}
        allowMultiple={false}
        readonly={readonly}
      />
      <FileCard
        title="自由资料池"
        fileType="free_resource"
        files={freeFiles}
        accept="*/*"
        uploading={uploadingType === 'free_resource'}
        onUpload={onUpload}
        onDownload={onDownload}
        onDelete={onDelete}
        allowMultiple={true}
        readonly={readonly}
      />
    </div>
  );
}
