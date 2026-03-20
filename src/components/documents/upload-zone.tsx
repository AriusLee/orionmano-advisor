'use client';

import { useRef, useState } from 'react';
import { Upload, FileText, Loader2, CheckCircle, XCircle, Trash2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface UploadedDoc {
  id: string;
  filename: string;
  extraction_status: string;
}

interface UploadZoneProps {
  companyId: string;
  suggestedFiles: string[];
  documents: UploadedDoc[];
  onUploaded: () => void;
}

export function UploadZone({ companyId, suggestedFiles, documents, onUploaded }: UploadZoneProps) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFile = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', 'other');
      await apiFetch(`/companies/${companyId}/documents/upload`, {
        method: 'POST',
        body: formData,
      });
      toast.success(`Uploaded ${file.name}`);
      onUploaded();
    } catch {
      toast.error(`Failed to upload ${file.name}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    Array.from(e.dataTransfer.files).forEach(uploadFile);
  };

  const handleDelete = async (docId: string) => {
    try {
      await apiFetch(`/companies/${companyId}/documents/${docId}`, { method: 'DELETE' });
      toast.success('Document deleted');
      onUploaded();
    } catch {
      toast.error('Delete failed');
    }
  };

  const STATUS_ICON: Record<string, React.ReactNode> = {
    pending: <Loader2 className="h-3 w-3 animate-spin" />,
    processing: <Loader2 className="h-3 w-3 animate-spin" />,
    completed: <CheckCircle className="h-3 w-3" />,
    failed: <XCircle className="h-3 w-3" />,
  };

  const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    pending: 'outline',
    processing: 'secondary',
    completed: 'default',
    failed: 'destructive',
  };

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        className={cn(
          'flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors cursor-pointer',
          dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
        )}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="mb-3 h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium">{uploading ? 'Uploading...' : 'Drop files here or click to browse'}</p>
        <p className="mt-1 text-xs text-muted-foreground">PDF, Word, Excel — AI will auto-extract data</p>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          multiple
          accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
          onChange={(e) => {
            Array.from(e.target.files || []).forEach(uploadFile);
            e.target.value = '';
          }}
        />
      </div>

      {/* Suggested files */}
      {suggestedFiles.length > 0 && documents.length === 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Suggested documents to upload:</p>
          <div className="flex flex-wrap gap-2">
            {suggestedFiles.map((f) => (
              <Badge key={f} variant="outline" className="text-xs font-normal">
                {f}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Uploaded documents */}
      {documents.length > 0 && (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div key={doc.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
              <div className="flex items-center gap-2 text-sm min-w-0">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="truncate">{doc.filename}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant={STATUS_VARIANT[doc.extraction_status] || 'outline'} className="gap-1 text-xs">
                  {STATUS_ICON[doc.extraction_status]}
                  {doc.extraction_status}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 cursor-pointer text-muted-foreground hover:text-destructive"
                  onClick={(e) => { e.stopPropagation(); handleDelete(doc.id); }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
