import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Copy,
  FolderOpen,
  FileText,
  Download,
  Star,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { RepositorySettings } from "@/components/RepositorySettings";
import { FileUpload } from "@/components/FileUpload";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { User } from "@supabase/supabase-js";

type FileData = {
  path: string;
  hash: string;
  content: string | null;
  is_binary: boolean;
};

type FileTreeNode = {
  name: string;
  path: string;
  type: "file" | "folder";
  children?: FileTreeNode[];
  fileData?: FileData;
};

type FolderTreeProps = {
  nodes: FileTreeNode[];
  onFileClick: (file: FileData) => void;
};

const FolderTree: React.FC<FolderTreeProps> = ({ nodes, onFileClick }) => {
  return (
    <div>
      {nodes.map((node) =>
        node.type === "folder" ? (
          <Collapsible key={node.path} defaultOpen={false}>
            <CollapsibleTrigger asChild>
              <div className="flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-accent rounded">
                <FolderOpen className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-sm">{node.name}</span>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="ml-6">
              <FolderTree
                nodes={node.children || []}
                onFileClick={onFileClick}
              />
            </CollapsibleContent>
          </Collapsible>
        ) : (
          <div
            key={node.path}
            className="flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-accent rounded"
            onClick={() => onFileClick(node.fileData!)}
          >
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">{node.name}</span>
          </div>
        )
      )}
    </div>
  );
};

interface Profile {
  username: string | null;
  [key: string]: unknown;
}

interface Repository {
  id: string;
  name: string;
  description: string | null;
  branch?: string;
  owner_id?: string;
  profiles?: Profile;
  [key: string]: unknown;
}

const Repository = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [repository, setRepository] = useState<Repository | null>(null);
  const [files, setFiles] = useState<FileData[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileData | null>(null);
  const [fileTree, setFileTree] = useState<FileTreeNode[]>([]);
  const [readme, setReadme] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [starred, setStarred] = useState(false);
  const [starCount, setStarCount] = useState(0);
  const [uploadOpen, setUploadOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchRepository = useCallback(async () => {
    const { data, error } = await supabase
      .from("repos")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching repository:", error);
      setRepository(null);
      setLoading(false);
      return;
    }

    // Fetch profile separately if repo found
    let repoWithProfile: Repository | null = data;
    if (data && data.owner_id) {
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", data.owner_id)
        .single();
      if (profileError) {
        console.error("Error fetching profile:", profileError);
        repoWithProfile = { ...data, profiles: null } as Repository;
      } else {
        repoWithProfile = { ...data, profiles: profileData } as Repository;
      }
    }
    setRepository(repoWithProfile);
    setLoading(false);
  }, [id]);

  // Helper: Build folder tree from flat file list
  const buildFileTree = (files: FileData[]): FileTreeNode[] => {
    // Use objects for folders, arrays for children
    type FolderObj = { [name: string]: FolderObj | FileData };
    const root: FolderObj = {};
    for (const file of files) {
      const parts = file.path.split("/");
      let current: FolderObj = root;
      let fullPath = "";
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        fullPath = fullPath ? fullPath + "/" + part : part;
        if (i === parts.length - 1) {
          // File
          current[part] = file;
        } else {
          if (
            !current[part] ||
            typeof current[part] !== "object" ||
            Array.isArray(current[part])
          ) {
            current[part] = {};
          }
          current = current[part] as FolderObj;
        }
      }
    }
    // Convert FolderObj to FileTreeNode[] recursively
    const convert = (obj: FolderObj, parentPath = ""): FileTreeNode[] => {
      return Object.entries(obj).map(([name, value]) => {
        const nodePath = parentPath ? parentPath + "/" + name : name;
        if (
          typeof value === "object" &&
          !Array.isArray(value) &&
          !("path" in value)
        ) {
          // Folder
          return {
            name,
            path: nodePath,
            type: "folder",
            children: convert(value as FolderObj, nodePath),
          };
        } else {
          // File
          const fileData = value as FileData;
          return {
            name,
            path: nodePath,
            type: "file",
            fileData,
          };
        }
      });
    };
    return convert(root);
  };

  // Fetch files from latest commit in refs/heads/main
  const fetchFiles = useCallback(async () => {
    // 1. Fetch refs from Edge Function
    const SUPABASE_URL =
      import.meta.env.VITE_SUPABASE_URL ||
      "https://ubesznoqkyldvnxpheir.supabase.co";
    const refsUrl = `${SUPABASE_URL}/functions/v1/bit-refs/repos/${id}/refs`;

    // Get the current session for authentication
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (session?.access_token) {
      headers["Authorization"] = `Bearer ${session.access_token}`;
    }

    const refsRes = await fetch(refsUrl, { headers });
    const refsJson = await refsRes.json();
    const mainRef = (refsJson.refs || []).find(
      (r: any) => r.name === "refs/heads/main"
    );
    const commitHash = mainRef?.hash;
    if (!commitHash) {
      setFiles([]);
      setReadme("");
      return;
    }

    // 2. Download commit object from storage
    const commitPath = `repos/${id}/objects/${commitHash.slice(
      0,
      2
    )}/${commitHash.slice(2)}`;
    const { data: commitBlob } = await supabase.storage
      .from("bit-objects")
      .download(commitPath);
    if (!commitBlob) {
      setFiles([]);
      setReadme("");
      return;
    }
    const commitText = await commitBlob.text();
    let commitObj;
    try {
      commitObj = JSON.parse(commitText);
    } catch {
      setFiles([]);
      setReadme("");
      return;
    }

    // 3. Parse tree: { [path]: blobHash }
    const tree = commitObj.tree || {};
    const fileEntries = Object.entries(tree);
    const fileList: FileData[] = [];
    for (const [path, hashRaw] of fileEntries) {
      const hash = typeof hashRaw === "string" ? hashRaw : "";
      if (hash.length !== 40) continue;
      const objectPath = `repos/${id}/objects/${hash.slice(0, 2)}/${hash.slice(
        2
      )}`;
      const { data: blob } = await (supabase.storage as any)
        .from("bit-objects")
        .download(objectPath);
      let content = null;
      let is_binary = false;
      if (blob) {
        try {
          content = await blob.text();
        } catch {
          is_binary = true;
        }
      }
      fileList.push({ path, hash, content, is_binary });
    }
    setFiles(fileList);
    setFileTree(buildFileTree(fileList));
    // Find README
    const readmeFile = fileList.find(
      (f) => f.path.toLowerCase() === "readme.md"
    );
    setReadme(readmeFile?.content || "");
  }, [id]);

  const fetchStarStatus = useCallback(async () => {
    if (!user) return;

    const { data } = await supabase
      .from("stars")
      .select("id")
      .eq("repo_id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    setStarred(!!data);
  }, [id, user]);

  const fetchStarCount = useCallback(async () => {
    const { count } = await supabase
      .from("stars")
      .select("*", { count: "exact", head: true })
      .eq("repo_id", id);

    setStarCount(count || 0);
  }, [id]);

  useEffect(() => {
    if (id) {
      fetchRepository();
      fetchFiles();
      fetchStarStatus();
      fetchStarCount();
    }
  }, [id, fetchRepository, fetchFiles, fetchStarStatus, fetchStarCount]);

  const handleStar = async () => {
    if (!user) {
      toast.error("Please sign in to star repositories");
      return;
    }

    if (starred) {
      const { error } = await supabase
        .from("stars")
        .delete()
        .eq("repo_id", id)
        .eq("user_id", user.id);

      if (error) {
        toast.error(error.message);
      } else {
        setStarred(false);
        setStarCount(starCount - 1);
        toast.success("Repository unstarred");
      }
    } else {
      const { error } = await supabase
        .from("stars")
        .insert({ repo_id: id, user_id: user.id });

      if (error) {
        toast.error(error.message);
      } else {
        setStarred(true);
        setStarCount(starCount + 1);
        toast.success("Repository starred!");
      }
    }
  };

  // Download logic for CLI-pushed files is not implemented (binary only indicator)

  const handleCopyClone = () => {
    const cloneUrl = `${window.location.origin}/repo/${id}.git`;
    navigator.clipboard.writeText(cloneUrl);
    toast.success("Clone URL copied to clipboard");
  };

  const isOwner = user && repository && user.id === repository.owner_id;

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar user={user} />
        <div className="container mx-auto px-4 py-8">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!repository) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar user={user} />
        <div className="container mx-auto px-4 py-8">
          <p className="text-muted-foreground">Repository not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} />

      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold mb-2">
                <span
                  className="text-muted-foreground cursor-pointer hover:underline"
                  onClick={() => navigate("/")}
                >
                  {repository.profiles?.username}
                </span>
                {" / "}
                <span className="text-primary">{repository.name}</span>
              </h1>
              {repository.description && (
                <p className="text-muted-foreground">
                  {repository.description}
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                variant={starred ? "default" : "outline"}
                size="sm"
                onClick={handleStar}
              >
                <Star
                  className={`h-4 w-4 mr-2 ${starred ? "fill-current" : ""}`}
                />
                {starred ? "Starred" : "Star"}{" "}
                {starCount > 0 && `(${starCount})`}
              </Button>

              {isOwner && (
                <RepositorySettings
                  repository={repository}
                  onUpdate={fetchRepository}
                />
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-2 py-1 rounded-full border border-border text-xs">
              Public
            </span>
            <span className="text-sm text-muted-foreground">
              Branch: {repository.branch}
            </span>
            <Button variant="outline" size="sm" onClick={handleCopyClone}>
              <Copy className="mr-2 h-4 w-4" />
              Clone
            </Button>

            {isOwner && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setUploadOpen(!uploadOpen)}
              >
                <Upload className="mr-2 h-4 w-4" />
                Upload Files
              </Button>
            )}
          </div>
        </div>

        {isOwner && uploadOpen && (
          <div className="mb-6">
            <FileUpload repoId={id!} onUploadComplete={fetchFiles} />
          </div>
        )}

        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="font-semibold mb-4 flex items-center gap-2">
              <FolderOpen className="h-4 w-4" />
              Files
            </div>
            {fileTree.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No files in this repository
              </p>
            ) : (
              <div className="space-y-2">
                <FolderTree
                  nodes={fileTree}
                  onFileClick={(file) => setSelectedFile(file)}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {selectedFile && (
          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-4">
                <span className="font-semibold">{selectedFile.path}</span>
                {/* Download button removed for CLI-pushed files */}
              </div>
              {selectedFile.is_binary ? (
                <p className="text-muted-foreground text-sm">Binary file</p>
              ) : (
                <pre className="bg-muted p-4 rounded overflow-x-auto text-sm">
                  <code>{selectedFile.content}</code>
                </pre>
              )}
            </CardContent>
          </Card>
        )}

        {readme && (
          <Card>
            <CardContent className="p-6">
              <h2 className="text-xl font-bold mb-4">README.md</h2>
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <ReactMarkdown>{readme}</ReactMarkdown>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Repository;
