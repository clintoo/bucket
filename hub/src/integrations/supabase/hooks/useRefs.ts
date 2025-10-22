export interface Ref {
  name: string;
  hash: string;
  updated_at?: string;
}

export async function fetchRefs(token: string, repoId: string) {
  const res = await fetch(
    `${
      import.meta.env.VITE_SUPABASE_URL
    }/functions/v1/bit-refs/repos/${repoId}/refs`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        "Content-Type": "application/json",
      },
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

export async function updateRef(
  token: string,
  repoId: string,
  refName: string,
  oldHash: string | null,
  newHash: string
) {
  const res = await fetch(
    `${
      import.meta.env.VITE_SUPABASE_URL
    }/functions/v1/bit-refs/repos/${repoId}/refs/${encodeURIComponent(
      refName
    )}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ oldHash, newHash }),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}
