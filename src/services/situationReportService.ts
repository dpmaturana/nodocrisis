import { supabase } from "@/integrations/supabase/client";
import type { InitialSituationReport } from "@/types/database";

const COUNTRY_CODE = "ES";

export const situationReportService = {
  /**
   * Generate a situation report by calling the create-initial-situation-report edge function.
   * Returns the persisted draft from the database.
   */
  async generate(inputText: string): Promise<InitialSituationReport> {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;

    if (!token) {
      throw new Error("Debes iniciar sesión para crear un reporte.");
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
        country_code: COUNTRY_CODE,
        max_results: 8,
      }),
    });

    if (!resp.ok) {
      const body = await resp.json().catch(() => ({}));
      throw new Error(body.error || `Error ${resp.status}`);
    }

    const json = await resp.json();

    if (!json.success || !json.situation_report) {
      throw new Error("Respuesta inesperada del servidor.");
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
   * Confirm report and create event
   */
  async confirm(reportId: string): Promise<{ eventId: string }> {
    // For now, mark as confirmed. Event materialization can be expanded later.
    const { data, error } = await supabase
      .from("initial_situation_reports")
      .update({ status: "confirmed" as any })
      .eq("id", reportId)
      .select()
      .single();

    if (error) throw new Error(error.message);

    // Return the report id as a placeholder eventId until full materialization is built
    return { eventId: data.id };
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
