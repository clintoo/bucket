import { useState, useRef, useCallback } from "react";
import { Upload, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface FileUploadProps {
  repoId: string;
  onUploadComplete: () => void;
}

export const FileUpload = ({ repoId, onUploadComplete }: FileUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [filePath, setFilePath] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFiles(Array.from(e.dataTransfer.files));
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFiles(Array.from(e.target.files));
    }
  };

  const uploadFiles = async () => {
    if (selectedFiles.length === 0) {
      toast.error("Please select files to upload");
      return;
    }

    setUploading(true);

    try {
      for (const file of selectedFiles) {
        const finalPath = filePath ? `${filePath}/${file.name}` : file.name;
        const isTextFile =
          file.type.startsWith("text/") ||
          file.name.endsWith(".md") ||
          file.name.endsWith(".json") ||
          file.name.endsWith(".js") ||
          file.name.endsWith(".ts") ||
          file.name.endsWith(".tsx") ||
          file.name.endsWith(".jsx");

        if (isTextFile && file.size < 1024 * 1024) {
          // Store text files directly in the database
          const content = await file.text();
          const { error } = await supabase.from("files").insert({
            repo_id: repoId,
            path: finalPath,
            content,
            is_binary: false,
          });

          if (error) throw error;
        } else {
          // Store binary files in storage
          const storagePath = `${repoId}/${finalPath}`;
          const { error: uploadError } = await supabase.storage
            .from("repo-files")
            .upload(storagePath, file);

          if (uploadError) throw uploadError;

          const { error: dbError } = await supabase.from("files").insert({
            repo_id: repoId,
            path: finalPath,
            storage_path: storagePath,
            is_binary: true,
          });

          if (dbError) throw dbError;
        }
      }

      toast.success(`${selectedFiles.length} file(s) uploaded successfully`);
      setSelectedFiles([]);
      setFilePath("");
      onUploadComplete();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-6">
        <h3 className="font-semibold mb-4">Upload Files</h3>

        <div className="space-y-4">
          {/* <div>
            <Label htmlFor="file-path">Path (optional)</Label>
            <Input
              id="file-path"
              placeholder="e.g., src/components"
              value={filePath}
              onChange={(e) => setFilePath(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Leave empty to upload to root directory
            </p>
          </div> */}

          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive ? "border-primary bg-accent" : "border-border"
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
            <p className="mb-2 text-sm text-muted-foreground">
              Drag and drop files here, or click 'Browse' to upload from your
              device
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              Browse
            </Button>
          </div>

          {selectedFiles.length > 0 && (
            <div className="space-y-2">
              <Label>Selected Files:</Label>
              {selectedFiles.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between bg-accent p-2 rounded"
                >
                  <span className="text-sm truncate">{file.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setSelectedFiles(
                        selectedFiles.filter((_, i) => i !== index)
                      )
                    }
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <Button
            onClick={uploadFiles}
            disabled={uploading || selectedFiles.length === 0}
            className="w-full"
          >
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Commit changes{" "}
                {selectedFiles.length > 0 && `(${selectedFiles.length})`}
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
