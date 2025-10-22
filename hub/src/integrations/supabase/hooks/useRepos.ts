import { useEffect, useState } from "react";

export interface Repo {
  id: string;
  owner_id: string;
  name: string;
  visibility: "public" | "private";
  description?: string;
  created_at: string;
  updated_at: string;
}

export function useRepos(token: string) {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bit-repos`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        "Content-Type": "application/json",
      },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setRepos(data.repos || []);
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(String(err));
        setLoading(false);
      });
  }, [token]);

  return { repos, loading, error };
}

export async function createRepo(
  token: string,
  name: string,
  visibility: "public" | "private" = "private",
  description = ""
) {
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bit-repos`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, visibility, description }),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}
