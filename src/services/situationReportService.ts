import { supabase } from "@/integrations/supabase/client";
import type { InitialSituationReport } from "@/types/database";

export const situationReportService = {
  /**
   * Generate a situation report by calling the create-initial-situation-report edge function.
   * Returns the persisted draft from the database.
   */
  async generate(inputText: string, options?: { country_code?: string; lang?: string }): Promise<InitialSituationReport> {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;

    if (!token) {
      throw new Error("You must sign in to create a report.");
    }

    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-initial-situation-report`;

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({
        input_text: inputText,
        ...(options?.country_code ? { country_code: options.country_code } : {}),
        ...(options?.lang ? { lang: options.lang } : {}),
        max_results: 8,
      }),
    });

    if (!resp.ok) {
      const body = await resp.json().catch(() => ({}));
      throw new Error(body.error || `Error ${resp.status}`);
    }

    const json = await resp.json();

    if (!json.success || !json.situation_report) {
      throw new Error("Unexpected server response.");
    }

    // Normalize DB row to our frontend type
    return normalizeReport(json.situation_report);
  },

  /**
   * Fetch a report by ID from the database
   */
  async fetchById(reportId: string): Promise<InitialSituationReport | null> {
    const { data, error } = await supabase
      .from("initial_situation_reports")
      .select("*")
      .eq("id", reportId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return null;

    return normalizeReport(data);
  },

  /**
   * Update a draft report in the database
   */
  async updateDraft(
    reportId: string,
    updates: Partial<Pick<InitialSituationReport, "event_name_suggested" | "event_type" | "summary" | "suggested_sectors" | "suggested_capabilities">>
  ): Promise<InitialSituationReport> {
    const { data, error } = await supabase
      .from("initial_situation_reports")
      .update(updates as any)
      .eq("id", reportId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return normalizeReport(data);
  },

  /**
   * Discard a draft
   */
  async discard(reportId: string): Promise<void> {
    const { error } = await supabase
      .from("initial_situation_reports")
      .update({ status: "discarded" as any })
      .eq("id", reportId);

    if (error) throw new Error(error.message);
  },

  /**
   * Confirm report and create event, sectors and capacity needs in the DB
   */
  async confirm(reportId: string): Promise<{ eventId: string }> {
    // 1. Fetch the full report
    const { data: report, error: reportError } = await supabase
      .from("initial_situation_reports")
      .select("*")
      .eq("id", reportId)
      .single();

    if (reportError) throw new Error(reportError.message);

    // 2. Insert a new event row
    const { data: event, error: eventError } = await supabase
      .from("events")
      .insert({
        name: report.event_name_suggested || "New Event",
        type: report.event_type,
        status: "active",
      })
      .select()
      .single();

    if (eventError) throw new Error(eventError.message);

    const newEventId = event.id;

    // 3. Insert sectors (only those with include === true)
    const suggestedSectors: Array<{ name: string; latitude?: number | null; longitude?: number | null; confidence: number; include: boolean }> =
      Array.isArray(report.suggested_sectors)
        ? (report.suggested_sectors as Array<{ name: string; latitude?: number | null; longitude?: number | null; confidence: number; include: boolean }>)
        : [];

    const insertedSectorIds: string[] = [];

    for (const sector of suggestedSectors.filter((s) => s.include)) {
      const { data: insertedSector, error: sectorError } = await supabase
        .from("sectors")
        .insert({
          event_id: newEventId,
          canonical_name: sector.name,
          status: "unresolved",
          source: "ai_suggested",
          confidence: sector.confidence,
          latitude: sector.latitude ?? null,
          longitude: sector.longitude ?? null,
        })
        .select("id")
        .single();

      if (sectorError) {
        console.error(`Failed to insert sector "${sector.name}":`, sectorError.message);
      } else if (insertedSector) {
        insertedSectorIds.push(insertedSector.id);
      }
    }

    // 4. Insert capacity needs (sector_needs_context) per sector × included capability
    const suggestedCapabilities: Array<{ capability_name: string; confidence: number; include: boolean }> =
      Array.isArray(report.suggested_capabilities)
        ? (report.suggested_capabilities as Array<{ capability_name: string; confidence: number; include: boolean }>)
        : [];
    const includedCapabilities = suggestedCapabilities.filter((c) => c.include);

    if (includedCapabilities.length > 0 && insertedSectorIds.length > 0) {
      // Resolve capability names to capacity_type IDs
      const { data: capacityTypes } = await supabase
        .from("capacity_types")
        .select("id, name");

      if (capacityTypes && capacityTypes.length > 0) {
        const needsToInsert: {
          event_id: string;
          sector_id: string;
          capacity_type_id: string;
          level: "critical" | "high" | "medium" | "low";
          source: string;
          notes?: string;
        }[] = [];

        for (const sectorId of insertedSectorIds) {
          for (const cap of includedCapabilities) {
            const ct = capacityTypes.find(
              (c) => c.name.toLowerCase() === cap.capability_name.toLowerCase()
            );
            if (ct) {
              const confidence = cap.confidence ?? 0;
              const level: "critical" | "high" | "medium" | "low" =
                confidence >= 0.75 ? "critical" :
                confidence >= 0.5  ? "high"     :
                confidence >= 0.25 ? "medium"   : "low";
              needsToInsert.push({
                event_id: newEventId,
                sector_id: sectorId,
                capacity_type_id: ct.id,
                level,
                source: "situation_report",
                notes: JSON.stringify({
                  requirements: [],
                  description: null,
                }),
              });
            }
          }
        }

        if (needsToInsert.length > 0) {
          const { error: needsError } = await supabase.from("sector_needs_context").insert(needsToInsert);
          if (needsError) {
            console.error("Failed to insert capacity needs:", needsError.message);
          }
        }
      }
    }

    // 5. Insert news signals from report sources
    const MAX_SNIPPET_SCORE = 15; // expected max relevance score from news search
    const reportSources = Array.isArray(report.sources) ? report.sources : [];
    const newsContext = reportSources.find(
      (s: any) => s && s.kind === "news_context"
    ) as any;
    if (newsContext && Array.isArray(newsContext?.snippets) && newsContext.snippets.length > 0) {
      const signalsToInsert = newsContext.snippets.map((snippet: any) => ({
        event_id: newEventId,
        sector_id: null,
        signal_type: "news",
        source: snippet.title || snippet.source || "News",
        content: snippet.summary || snippet.content || snippet.title,
        confidence: snippet.score ? Math.min(snippet.score / MAX_SNIPPET_SCORE, 1) : 0.5,
        level: "event",
      }));
      const { error: signalsError } = await supabase.from("signals").insert(signalsToInsert);
      if (signalsError) {
        console.error("Failed to insert news signals:", signalsError.message);
      }
    }

    // 6. Mark report as confirmed and link to the new event
    const { error: updateError } = await supabase
      .from("initial_situation_reports")
      .update({ status: "confirmed" as any, linked_event_id: newEventId })
      .eq("id", reportId);

    if (updateError) throw new Error(updateError.message);

    // 7. Return the real event ID
    return { eventId: newEventId };
  },
};

/** Normalize a DB row into our frontend InitialSituationReport type */
function normalizeReport(row: any): InitialSituationReport {
  return {
    id: row.id,
    created_by: row.created_by,
    status: row.status,
    input_text: row.input_text,
    event_name_suggested: row.event_name_suggested,
    event_type: row.event_type,
    summary: row.summary,
    suggested_sectors: Array.isArray(row.suggested_sectors) ? row.suggested_sectors : [],
    suggested_capabilities: Array.isArray(row.suggested_capabilities) ? row.suggested_capabilities : [],
    sources: Array.isArray(row.sources) ? row.sources : [],
    overall_confidence: row.overall_confidence,
    linked_event_id: row.linked_event_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
