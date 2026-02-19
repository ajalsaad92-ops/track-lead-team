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

    const body = await req.json();
    const action = body.action;

    if (action === "seed_all") {
      const results: any[] = [];

      const createUser = async (email: string, password: string, full_name: string, role: string, unit: string | null, duty_system: string) => {
        const { data: existingUsers } = await adminClient.auth.admin.listUsers();
        const existing = existingUsers?.users?.find((u: any) => u.email === email);
        if (existing) {
          return { email, status: "already_exists", user_id: existing.id };
        }

        const { data: newUser, error } = await adminClient.auth.admin.createUser({
          email, password, email_confirm: true,
          user_metadata: { full_name },
        });
        if (error) return { email, status: "error", error: error.message };
        const userId = newUser.user.id;

        await new Promise(r => setTimeout(r, 300));

        await adminClient.from("profiles").update({ full_name, unit, duty_system }).eq("user_id", userId);
        await adminClient.from("user_roles").insert({ user_id: userId, role, unit: role === "unit_head" ? unit : null });

        const currentMonth = new Date().toISOString().slice(0, 7) + "-01";
        await adminClient.from("leave_balances").insert({ user_id: userId, month: currentMonth });

        return { email, status: "created", user_id: userId, role, unit };
      };

      // Unit Heads
      results.push(await createUser("uh.preparation@test.com", "password123", "أحمد الحربي", "unit_head", "preparation", "daily"));
      results.push(await createUser("uh.curriculum@test.com", "password123", "خالد العتيبي", "unit_head", "curriculum", "daily"));

      // Individuals - Preparation unit (5)
      results.push(await createUser("prep1@test.com", "password123", "محمد السالم", "individual", "preparation", "daily"));
      results.push(await createUser("prep2@test.com", "password123", "عبدالله الشمري", "individual", "preparation", "shift_77"));
      results.push(await createUser("prep3@test.com", "password123", "فهد القحطاني", "individual", "preparation", "daily"));
      results.push(await createUser("prep4@test.com", "password123", "سعود المالكي", "individual", "preparation", "shift_1515"));
      results.push(await createUser("prep5@test.com", "password123", "ناصر الدوسري", "individual", "preparation", "daily"));

      // Individuals - Curriculum unit (5)
      results.push(await createUser("curr1@test.com", "password123", "يوسف الغامدي", "individual", "curriculum", "daily"));
      results.push(await createUser("curr2@test.com", "password123", "عمر الزهراني", "individual", "curriculum", "shift_77"));
      results.push(await createUser("curr3@test.com", "password123", "بدر العنزي", "individual", "curriculum", "daily"));
      results.push(await createUser("curr4@test.com", "password123", "طلال المطيري", "individual", "curriculum", "shift_1515"));
      results.push(await createUser("curr5@test.com", "password123", "راكان السبيعي", "individual", "curriculum", "daily"));

      return new Response(JSON.stringify({ success: true, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Legacy: seed single admin
    const { email, password, full_name } = body;
    const { count } = await adminClient
      .from("user_roles")
      .select("*", { count: "exact", head: true })
      .eq("role", "admin");

    const isFirstAdmin = (count ?? 0) === 0;

    if (!isFirstAdmin) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) throw new Error("Unauthorized");
      const token = authHeader.replace("Bearer ", "");
      const { data: { user: caller } } = await adminClient.auth.getUser(token);
      if (!caller) throw new Error("Unauthorized");
      const { data: callerRole } = await adminClient
        .from("user_roles").select("role").eq("user_id", caller.id).eq("role", "admin").maybeSingle();
      if (!callerRole) throw new Error("Only admin can create users");
    }

    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { full_name },
    });
    if (createError) throw createError;
    const userId = newUser.user.id;

    await adminClient.from("profiles").update({ full_name, unit: null, duty_system: "daily" }).eq("user_id", userId);
    await adminClient.from("user_roles").insert({ user_id: userId, role: "admin", unit: null });
    const currentMonth = new Date().toISOString().slice(0, 7) + "-01";
    await adminClient.from("leave_balances").insert({ user_id: userId, month: currentMonth });

    return new Response(JSON.stringify({ success: true, user_id: userId, first_admin: isFirstAdmin }), {
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
