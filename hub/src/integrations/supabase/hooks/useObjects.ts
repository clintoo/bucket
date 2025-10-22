export async function headObject(token: string, repoId: string, hash: string) {
  const res = await fetch(
    `${
      import.meta.env.VITE_SUPABASE_URL
    }/functions/v1/bit-objects/repos/${repoId}/objects/${hash}`,
    {
      method: "HEAD",
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
    }
  );
  return res.ok;
}

export async function getObject(token: string, repoId: string, hash: string) {
  const res = await fetch(
    `${
      import.meta.env.VITE_SUPABASE_URL
    }/functions/v1/bit-objects/repos/${repoId}/objects/${hash}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
    }
  );
  if (!res.ok) throw new Error("Object not found");
  return await res.arrayBuffer();
}

export async function putObject(
  token: string,
  repoId: string,
  hash: string,
  data: ArrayBuffer
) {
  const res = await fetch(
    `${
      import.meta.env.VITE_SUPABASE_URL
    }/functions/v1/bit-objects/repos/${repoId}/objects/${hash}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        "Content-Type": "application/octet-stream",
      },
      body: data,
    }
  );
  const result = await res.json();
  if (!res.ok) throw new Error(result.error || res.statusText);
  return result;
}
