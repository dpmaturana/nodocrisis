import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { event_id } = await req.json();
    if (!event_id) {
      return new Response(JSON.stringify({ error: "event_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Find the situation report linked to this event
    const { data: report, error: reportErr } = await supabase
      .from("initial_situation_reports")
      .select("suggested_capabilities")
      .eq("linked_event_id", event_id)
      .maybeSingle();

    if (reportErr) throw reportErr;

    // 2. Get sectors for this event
    const { data: sectors, error: sectorsErr } = await supabase
      .from("sectors")
      .select("id")
      .eq("event_id", event_id);

    if (sectorsErr) throw sectorsErr;
    if (!sectors || sectors.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No sectors found", inserted: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Get all capacity types
    const { data: capacityTypes, error: ctErr } = await supabase
      .from("capacity_types")
      .select("id, name");

    if (ctErr) throw ctErr;
    if (!capacityTypes || capacityTypes.length === 0) {
      return new Response(
        JSON.stringify({ error: "No capacity types in database" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Build needs from suggested_capabilities (or use defaults)
    const suggestedCaps: Array<{ capability_name: string; confidence: number; include: boolean }> =
      Array.isArray(report?.suggested_capabilities) ? report.suggested_capabilities : [];

    const includedCaps = suggestedCaps.filter((c) => c.include !== false);

    // Resolve to capacity_type_ids
    const resolvedCaps: Array<{ capacity_type_id: string; level: string }> = [];

    if (includedCaps.length > 0) {
      for (const cap of includedCaps) {
        const ct = capacityTypes.find(
          (c) => c.name.toLowerCase() === cap.capability_name.toLowerCase()
        );
        if (ct) {
          const confidence = cap.confidence ?? 0;
          const level =
            confidence >= 0.75 ? "critical" :
            confidence >= 0.5 ? "high" :
            confidence >= 0.25 ? "medium" : "low";
          resolvedCaps.push({ capacity_type_id: ct.id, level });
        }
      }
    }

    // Fallback: if no caps resolved, assign top 5 capacity types at "high"
    if (resolvedCaps.length === 0) {
      const fallbackNames = [
        "Emergency medical care",
        "Search and rescue",
        "Shelter / housing",
        "Drinking water",
        "Food supply",
      ];
      for (const name of fallbackNames) {
        const ct = capacityTypes.find((c) => c.name === name);
        if (ct) resolvedCaps.push({ capacity_type_id: ct.id, level: "high" });
      }
    }

    // 5. Build insert rows (sector × capability)
    const rows = [];
    for (const sector of sectors) {
      for (const cap of resolvedCaps) {
        rows.push({
          event_id,
          sector_id: sector.id,
          capacity_type_id: cap.capacity_type_id,
          level: cap.level,
          source: "situation_report",
        });
      }
    }

    if (rows.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "Nothing to insert", inserted: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 6. Upsert (leveraging the unique constraint on event_id, sector_id, capacity_type_id)
    const { error: insertErr } = await supabase
      .from("sector_needs_context")
      .upsert(rows, { onConflict: "event_id,sector_id,capacity_type_id" });

    if (insertErr) throw insertErr;

    return new Response(
      JSON.stringify({ success: true, inserted: rows.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("materialize-event-needs error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
