import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useRepos, createRepo } from "@/integrations/supabase/hooks/useRepos";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Plus, Book, Clock, Star } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

type Profile = {
  id: string;
  username: string;
  bio?: string;
};

type Repository = {
  id: string;
  name: string;
  description?: string;
  updated_at: string;
};

type StarredRepo = Repository & {
  profiles?: {
    username: string;
  };
};

const Dashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [token, setToken] = useState<string>("");
  const { repos: repositories, loading: reposLoading, error } = useRepos(token);
  const [starredRepos, setStarredRepos] = useState<StarredRepo[]>([]);
  const [newRepoName, setNewRepoName] = useState("");
  const [newRepoDesc, setNewRepoDesc] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"repos" | "starred">("repos");
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
        setToken(session.access_token);
        fetchProfile(session.user.id);
        fetchStarredRepositories(session.user.id);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
        setToken(session.access_token);
        fetchProfile(session.user.id);
        fetchStarredRepositories(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    setProfile(data);
  };

  const fetchStarredRepositories = async (userId: string) => {
    const { data } = await supabase
      .from("stars")
      .select("*, repositories(*, profiles(username))")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    setStarredRepos(data?.map((s) => s.repositories) || []);
  };

  const handleCreateRepo = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newRepoName.trim()) {
      toast.error("Repository name is required");
      return;
    }

    try {
      await createRepo(token, newRepoName, "private", newRepoDesc);
      toast.success("Repository created successfully!");
      setNewRepoName("");
      setNewRepoDesc("");
      setDialogOpen(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg);
    }
  };

  if (reposLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar user={user} />
        <div className="container mx-auto px-4 py-8">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} />

      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">{profile?.username}</h1>
            {profile?.bio && (
              <p className="text-muted-foreground">{profile.bio}</p>
            )}
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Repository
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create a new repository</DialogTitle>
                <DialogDescription>
                  Add a name and description for your repository
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateRepo} className="space-y-4">
                <div>
                  <Label htmlFor="repo-name">Repository name</Label>
                  <Input
                    id="repo-name"
                    value={newRepoName}
                    onChange={(e) => setNewRepoName(e.target.value)}
                    placeholder="my-awesome-project"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="repo-desc">Description (optional)</Label>
                  <Textarea
                    id="repo-desc"
                    value={newRepoDesc}
                    onChange={(e) => setNewRepoDesc(e.target.value)}
                    placeholder="A brief description of your project"
                  />
                </div>
                <Button type="submit" className="w-full">
                  Create repository
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="border-b border-border mb-6">
          <div className="flex gap-6">
            <button
              className={`flex items-center gap-2 pb-3 border-b-2 transition-colors ${
                activeTab === "repos"
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setActiveTab("repos")}
            >
              <Book className="h-4 w-4" />
              <span className="font-semibold">
                Repositories {repositories.length}
              </span>
            </button>
            <button
              className={`flex items-center gap-2 pb-3 border-b-2 transition-colors ${
                activeTab === "starred"
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setActiveTab("starred")}
            >
              <Star className="h-4 w-4" />
              <span className="font-semibold">
                Starred {starredRepos.length}
              </span>
            </button>
          </div>
        </div>

        {activeTab === "repos" && (
          <>
            {repositories.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground mb-4">
                    No repositories yet
                  </p>
                  <Button onClick={() => setDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create your first repository
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {repositories.map((repo) => (
                  <Card
                    key={repo.id}
                    className="hover:bg-accent cursor-pointer transition-colors"
                    onClick={() => navigate(`/repo/${repo.id}`)}
                  >
                    <CardHeader>
                      <CardTitle className="text-primary hover:underline">
                        {repo.name}
                      </CardTitle>
                      {repo.description && (
                        <CardDescription>{repo.description}</CardDescription>
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="px-2 py-1 rounded-full border border-border text-xs">
                          Public
                        </span>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Updated{" "}
                          {formatDistanceToNow(new Date(repo.updated_at), {
                            addSuffix: true,
                          })}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === "starred" && (
          <>
            {starredRepos.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground mb-4">
                    No starred repositories yet
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Star repositories to see them here!
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {starredRepos.map((repo) => (
                  <Card
                    key={repo.id}
                    className="hover:bg-accent cursor-pointer transition-colors"
                    onClick={() => navigate(`/repo/${repo.id}`)}
                  >
                    <CardHeader>
                      <CardTitle className="text-primary hover:underline">
                        {repo.profiles?.username || "Unknown"} / {repo.name}
                      </CardTitle>
                      {repo.description && (
                        <CardDescription>{repo.description}</CardDescription>
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="px-2 py-1 rounded-full border border-border text-xs">
                          Public
                        </span>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Updated{" "}
                          {formatDistanceToNow(new Date(repo.updated_at), {
                            addSuffix: true,
                          })}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
