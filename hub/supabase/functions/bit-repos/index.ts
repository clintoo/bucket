// @ts-expect-error - Deno import for Edge Function
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-expect-error - Supabase JS import for Edge Function
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
      // @ts-expect-error - Deno env access
      (typeof Deno !== "undefined" ? Deno.env.get("SUPABASE_URL") : "") ?? "",
      // @ts-expect-error - Deno env access
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

    // POST /repos - Create a new repo
    if (req.method === "POST" && pathParts.length === 0) {
      const body = await req.json();
      const { name, visibility = "private", description = "" } = body;

      if (!name || typeof name !== "string") {
        return new Response(JSON.stringify({ error: "Name is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: repo, error } = await supabaseClient
        .from("repos")
        .insert({
          owner_id: user.id,
          name,
          visibility,
          description,
        })
        .select()
        .single();

      if (error) {
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

      // Create default ref (refs/heads/main) pointing to null initially
      await supabaseClient.from("refs").insert({
        repo_id: repo.id,
        name: "refs/heads/main",
        hash: "0000000000000000000000000000000000000000",
      });

      return new Response(
        JSON.stringify({
          repoId: repo.id,
          name: repo.name,
          defaultRef: "refs/heads/main",
        }),
        {
          status: 201,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // GET /repos - List repos accessible to the user
    if (req.method === "GET" && pathParts.length === 0) {
      const { data: repos, error } = await supabaseClient
        .from("repos")
        .select("*")
        .order("updated_at", { ascending: false });

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ repos }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET /repos/:id - Get a specific repo
    if (req.method === "GET" && pathParts.length === 1) {
      const repoId = pathParts[0];

      const { data: repo, error } = await supabaseClient
        .from("repos")
        .select("*")
        .eq("id", repoId)
        .single();

      if (error || !repo) {
        return new Response(JSON.stringify({ error: "Repo not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify(repo), {
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
