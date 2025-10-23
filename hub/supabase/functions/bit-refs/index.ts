// @ts-expect-error - Deno import for Edge Function
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-expect-error - Deno import for Edge Function
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      // @ts-expect-error - Deno global for Edge Function
      (typeof Deno !== "undefined" ? Deno.env.get("SUPABASE_URL") : "") ?? "",
      // @ts-expect-error - Deno global for Edge Function
      (typeof Deno !== "undefined" ? Deno.env.get("SUPABASE_ANON_KEY") : "") ??
        "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    // Admin client to perform storage checks with stronger consistency / bypass RLS
    const supabaseAdmin = createClient(
      // @ts-expect-error - Deno global for Edge Function
      (typeof Deno !== "undefined" ? Deno.env.get("SUPABASE_URL") : "") ?? "",
      // @ts-expect-error - Deno global for Edge Function
      (typeof Deno !== "undefined"
        ? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
        : "") ?? "",
      {
        auth: { persistSession: false },
      }
    );

    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter((p) => p);

    // Skip function name prefix (e.g., "bit-refs") and get the actual path
    // Expected path after function name: repos/:repoId/refs or repos/:repoId/refs/:refName
    const actualPath =
      pathParts[0] === "bit-refs" ? pathParts.slice(1) : pathParts;

    if (actualPath.length < 2 || actualPath[0] !== "repos") {
      return new Response(JSON.stringify({ error: "Invalid path" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const repoId = actualPath[1];

    // Verify repo exists and user has access
    const { data: repo, error: repoError } = await supabaseClient
      .from("repos")
      .select("*")
      .eq("id", repoId)
      .single();

    if (repoError || !repo) {
      return new Response(JSON.stringify({ error: "Repo not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET /repos/:repoId/refs - List all refs
    if (
      req.method === "GET" &&
      actualPath.length === 3 &&
      actualPath[2] === "refs"
    ) {
      const { data: refs, error } = await supabaseClient
        .from("refs")
        .select("*")
        .eq("repo_id", repoId)
        .order("name");

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Find HEAD (default: refs/heads/main)
      const mainRef = refs?.find(
        (r: { name: string }) => r.name === "refs/heads/main"
      );
      const head = mainRef ? `ref: ${mainRef.name}` : null;

      return new Response(
        JSON.stringify({
          head,
          refs: refs || [],
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // PUT /repos/:repoId/refs/:refName - Update a ref with CAS
    if (
      req.method === "PUT" &&
      actualPath.length >= 4 &&
      actualPath[2] === "refs"
    ) {
      // Only owner can update refs
      if (repo.owner_id !== user.id) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const refName = actualPath.slice(3).join("/");
      const body = await req.json();
      const { oldHash, newHash } = body;

      if (!newHash || !/^[0-9a-f]{40}$/.test(newHash)) {
        return new Response(JSON.stringify({ error: "Invalid newHash" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Disallow the all-zero hash to avoid broken refs
      if (/^0{40}$/.test(newHash)) {
        return new Response(
          JSON.stringify({ error: "Invalid newHash: zero hash not allowed" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Get current ref
      const { data: currentRef } = await supabaseClient
        .from("refs")
        .select("*")
        .eq("repo_id", repoId)
        .eq("name", refName)
        .single();

      // CAS check
      const currentHash =
        currentRef?.hash || "0000000000000000000000000000000000000000";

      if (oldHash && oldHash !== currentHash) {
        return new Response(
          JSON.stringify({
            error: "CAS_FAILED",
            current: currentHash,
          }),
          {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Strong consistency check: ensure the new commit object exists in storage
      const bucketName = "bit-objects";
      const objectPath = `repos/${repoId}/objects/${newHash.slice(
        0,
        2
      )}/${newHash.slice(2)}`;

      // Retry up to 5 times with short backoff to avoid race with recent uploads
      let found = false;
      for (let attempt = 0; attempt < 5 && !found; attempt++) {
        const { data: objData } = await supabaseAdmin.storage
          .from(bucketName)
          .download(objectPath);
        if (objData) {
          found = true;
          break;
        }
        // 150ms backoff
        await new Promise((r) => setTimeout(r, 150));
      }

      if (!found) {
        return new Response(
          JSON.stringify({ error: "Missing object for newHash" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      // Object confirmed by admin check above

      // Update or insert ref
      const { error: upsertError } = await supabaseClient.from("refs").upsert(
        {
          repo_id: repoId,
          name: refName,
          hash: newHash,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "repo_id,name",
        }
      );

      if (upsertError) {
        return new Response(JSON.stringify({ error: upsertError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update repo updated_at
      await supabaseClient
        .from("repos")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", repoId);

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
