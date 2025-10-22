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

    // Expected: repos/:repoId/objects/:hash
    if (
      pathParts.length < 4 ||
      pathParts[0] !== "repos" ||
      pathParts[2] !== "objects"
    ) {
      return new Response(JSON.stringify({ error: "Invalid path" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const repoId = pathParts[1];
    const hash = pathParts[3];

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

      // Try to parse as JSON to check if it's a commit object
      try {
        const text = new TextDecoder().decode(bodyBytes);
        const obj = JSON.parse(text);

        // If it's a commit object, validate author email
        if (obj.author && obj.author.email) {
          if (obj.author.email !== user.email) {
            return new Response(
              JSON.stringify({
                error: "Forbidden: author email must match authenticated user",
                expected: user.email,
                got: obj.author.email,
              }),
              {
                status: 403,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              }
            );
          }
        }
      } catch {
        // Not JSON or not a commit, that's fine - could be a blob
      }

      // Upload to storage
      const { error: uploadError } = await supabaseClient.storage
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
