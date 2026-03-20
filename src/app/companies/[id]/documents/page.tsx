"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { apiFetch, apiJson } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, Loader2, CheckCircle, XCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Document {
  id: string;
  filename: string;
  file_size: number | null;
  category: string | null;
  extraction_status: string;
  extracted_data: Record<string, unknown> | null;
  created_at: string;
}

const STATUS_MAP: Record<string, { icon: React.ReactNode; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { icon: <Loader2 className="h-3 w-3 animate-spin" />, variant: "outline" },
  processing: { icon: <Loader2 className="h-3 w-3 animate-spin" />, variant: "secondary" },
  completed: { icon: <CheckCircle className="h-3 w-3" />, variant: "default" },
  failed: { icon: <XCircle className="h-3 w-3" />, variant: "destructive" },
};

export default function DocumentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [docs, setDocs] = useState<Document[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadDocs = useCallback(() => {
    apiJson<Document[]>(`/companies/${id}/documents`).then(setDocs);
  }, [id]);

  useEffect(() => {
    loadDocs();
    const interval = setInterval(loadDocs, 5000);
    return () => clearInterval(interval);
  }, [loadDocs]);

  const uploadFile = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("category", "other");
      await apiFetch(`/companies/${id}/documents/upload`, {
        method: "POST",
        body: formData,
      });
      toast.success(`Uploaded ${file.name}`);
      loadDocs();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    files.forEach(uploadFile);
  };

  const handleDelete = async (docId: string) => {
    try {
      await apiFetch(`/companies/${id}/documents/${docId}`, { method: "DELETE" });
      setDocs((prev) => prev.filter((d) => d.id !== docId));
      toast.success("Document deleted");
    } catch {
      toast.error("Delete failed");
    }
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">Documents</h2>

      {/* Upload Zone */}
      <div
        className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 transition-colors cursor-pointer ${
          dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="mb-4 h-10 w-10 text-muted-foreground" />
        <p className="font-medium">{uploading ? "Uploading..." : "Drop files here or click to browse"}</p>
        <p className="mt-1 text-sm text-muted-foreground">PDF, Word, Excel, images — AI will auto-extract data</p>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          multiple
          accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
          onChange={(e) => {
            const files = Array.from(e.target.files || []);
            files.forEach(uploadFile);
            e.target.value = "";
          }}
        />
      </div>

      {/* Document List */}
      {docs.length > 0 && (
        <div className="space-y-3">
          {docs.map((doc) => {
            const status = STATUS_MAP[doc.extraction_status] || STATUS_MAP.pending;
            return (
              <Card key={doc.id}>
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-3">
                    <FileText className="h-8 w-8 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{doc.filename}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatSize(doc.file_size)} · {new Date(doc.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={status.variant} className="gap-1">
                      {status.icon} {doc.extraction_status}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 cursor-pointer text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(doc.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
