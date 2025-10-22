import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Settings, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Repository {
  id: string;
  name: string;
  description: string | null;
  [key: string]: unknown;
}

interface RepositorySettingsProps {
  repository: Repository;
  onUpdate: () => void;
}

export const RepositorySettings = ({
  repository,
  onUpdate,
}: RepositorySettingsProps) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(repository.name);
  const [description, setDescription] = useState(repository.description || "");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleUpdate = async () => {
    setLoading(true);
    const { error } = await supabase
      .from("repositories")
      .update({ name, description })
      .eq("id", repository.id);

    setLoading(false);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Repository updated successfully");
      setOpen(false);
      onUpdate();
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    const { error } = await supabase
      .from("repositories")
      .delete()
      .eq("id", repository.id);

    setLoading(false);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Repository deleted successfully");
      navigate("/");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Repository Settings</DialogTitle>
          <DialogDescription>
            Update your repository details or delete it permanently.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="name">Repository Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="my-awesome-repo"
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A brief description of your repository"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="flex justify-between sm:justify-between">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Repository
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete
                  your repository and all associated files.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} disabled={loading}>
                  Yes, I'm sure
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={loading}>
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
