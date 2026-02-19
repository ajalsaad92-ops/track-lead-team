import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorized");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller } } = await adminClient.auth.getUser(token);
    if (!caller) throw new Error("Unauthorized");

    const { data: callerRole } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!callerRole) throw new Error("Only admin can create users");

    const { email, password, full_name, role, unit, duty_system, phone } = await req.json();

    // Create auth user
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });

    if (createError) throw createError;
    const userId = newUser.user.id;

    // Wait a moment for the trigger to create the profile
    await new Promise(r => setTimeout(r, 500));

    // Update profile with full details
    await adminClient
      .from("profiles")
      .update({ full_name, unit, duty_system: duty_system || "daily", phone: phone || null })
      .eq("user_id", userId);

    // Assign role
    await adminClient
      .from("user_roles")
      .insert({ user_id: userId, role, unit: role === "unit_head" ? unit : null });

    // Create initial leave balance
    const currentMonth = new Date().toISOString().slice(0, 7) + "-01";
    await adminClient
      .from("leave_balances")
      .insert({ user_id: userId, month: currentMonth });

    // Audit log
    await adminClient
      .from("audit_log")
      .insert({
        user_id: caller.id,
        action: "create_user",
        target_type: "user",
        target_id: userId,
        details: { email, role, unit, full_name },
      });

    return new Response(JSON.stringify({ success: true, user_id: userId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
