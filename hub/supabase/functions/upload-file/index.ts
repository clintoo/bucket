// @ts-expect-error - Deno import for Edge Function
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-expect-error - Deno import for Edge Function
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      // @ts-expect-error - Deno global for Edge Function
      Deno.env.get("SUPABASE_URL") ?? "",
      // @ts-expect-error - Deno global for Edge Function
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
    } = await supabaseClient.auth.getUser(token);

    if (!user) {
      throw new Error("Unauthorized");
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const repoId = formData.get("repo_id") as string;
    const path = formData.get("path") as string;

    if (!file || !repoId || !path) {
      throw new Error("Missing required fields");
    }

    // Check if user owns the repository
    const { data: repo, error: repoError } = await supabaseClient
      .from("repositories")
      .select("user_id")
      .eq("id", repoId)
      .single();

    if (repoError || repo.user_id !== user.id) {
      throw new Error("Unauthorized to upload to this repository");
    }

    // Determine if file is text or binary
    const isTextFile =
      file.type.startsWith("text/") ||
      file.name.endsWith(".md") ||
      file.name.endsWith(".json") ||
      file.name.endsWith(".js") ||
      file.name.endsWith(".ts") ||
      file.name.endsWith(".tsx") ||
      file.name.endsWith(".jsx");

    if (isTextFile && file.size < 1024 * 1024) {
      // Store text files in database
      const content = await file.text();
      const { error } = await supabaseClient.from("files").insert({
        repo_id: repoId,
        path,
        content,
        is_binary: false,
      });

      if (error) throw error;
    } else {
      // Store binary files in storage
      const storagePath = `${repoId}/${path}`;
      const fileData = await file.arrayBuffer();

      const { error: uploadError } = await supabaseClient.storage
        .from("repo-files")
        .upload(storagePath, fileData, {
          contentType: file.type,
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabaseClient.from("files").insert({
        repo_id: repoId,
        path,
        storage_path: storagePath,
        is_binary: true,
      });

      if (dbError) throw dbError;
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Upload failed",
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
