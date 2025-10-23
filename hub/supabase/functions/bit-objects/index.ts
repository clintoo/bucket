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

    // Admin client (service role) to perform storage writes after our own checks
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

    // Skip function name prefix (e.g., "bit-objects") and get the actual path
    // Expected path after function name: repos/:repoId/objects/:hash
    const actualPath =
      pathParts[0] === "bit-objects" ? pathParts.slice(1) : pathParts;

    if (
      actualPath.length < 4 ||
      actualPath[0] !== "repos" ||
      actualPath[2] !== "objects"
    ) {
      return new Response(JSON.stringify({ error: "Invalid path" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const repoId = actualPath[1];
    const hash = actualPath[3];

    // Validate hash format
    if (!/^[0-9a-f]{40}$/.test(hash)) {
      return new Response(JSON.stringify({ error: "Invalid hash format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    const bucketName = "bit-objects";
    const objectPath = `repos/${repoId}/objects/${hash.slice(
      0,
      2
    )}/${hash.slice(2)}`;

    // HEAD - Check if object exists
    if (req.method === "HEAD") {
      const { data, error } = await supabaseClient.storage
        .from(bucketName)
        .download(objectPath);

      if (error || !data) {
        return new Response(null, {
          status: 404,
          headers: corsHeaders,
        });
      }

      return new Response(null, {
        status: 200,
        headers: corsHeaders,
      });
    }

    // GET - Download object
    if (req.method === "GET") {
      const { data, error } = await supabaseClient.storage
        .from(bucketName)
        .download(objectPath);

      if (error || !data) {
        return new Response(JSON.stringify({ error: "Object not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(data, {
        headers: { ...corsHeaders, "Content-Type": "application/octet-stream" },
      });
    }

    // PUT - Upload object
    if (req.method === "PUT") {
      // Only owner can upload objects
      if (repo.owner_id !== user.id) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const body = await req.arrayBuffer();
      const bodyBytes = new Uint8Array(body);

      // Note: We do not enforce commit author email here to avoid blocking pushes.
      // Authorization is enforced via repo ownership check below and ref updates in bit-refs.

      // Only owner can upload objects for now (collaborator support can be added later)
      if (repo.owner_id !== user.id) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Upload to storage (use admin client to bypass storage RLS after our checks)
      const { error: uploadError } = await supabaseAdmin.storage
        .from(bucketName)
        .upload(objectPath, bodyBytes, {
          contentType: "application/octet-stream",
          upsert: true,
        });

      if (uploadError) {
        return new Response(JSON.stringify({ error: uploadError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
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
