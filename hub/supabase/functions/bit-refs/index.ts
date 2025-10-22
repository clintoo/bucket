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

    // Expected: repos/:repoId/refs or repos/:repoId/refs/:refName
    if (pathParts.length < 2 || pathParts[0] !== "repos") {
      return new Response(JSON.stringify({ error: "Invalid path" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const repoId = pathParts[1];

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
      pathParts.length === 3 &&
      pathParts[2] === "refs"
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
      pathParts.length >= 4 &&
      pathParts[2] === "refs"
    ) {
      // Only owner can update refs
      if (repo.owner_id !== user.id) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const refName = pathParts.slice(3).join("/");
      const body = await req.json();
      const { oldHash, newHash } = body;

      if (!newHash || !/^[0-9a-f]{40}$/.test(newHash)) {
        return new Response(JSON.stringify({ error: "Invalid newHash" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
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
