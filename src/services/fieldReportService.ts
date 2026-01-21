import { supabase } from "@/integrations/supabase/client";
import type { FieldReport, CreateFieldReportParams, ExtractedData, FieldReportStatus } from "@/types/fieldReport";

// Helper to transform DB response to typed FieldReport
function toFieldReport(row: any): FieldReport {
  return {
    id: row.id,
    event_id: row.event_id,
    sector_id: row.sector_id,
    actor_id: row.actor_id,
    audio_url: row.audio_url,
    transcript: row.transcript,
    text_note: row.text_note,
    status: row.status as FieldReportStatus,
    extracted_data: row.extracted_data as ExtractedData | null,
    error_message: row.error_message,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export const fieldReportService = {
  /**
   * Upload audio file and create a field report record
   */
  async createReport(params: CreateFieldReportParams, actorId: string): Promise<FieldReport> {
    const { event_id, sector_id, audio_file, text_note } = params;
    
    // Generate unique filename
    const timestamp = Date.now();
    const filename = `${actorId}/${event_id}_${sector_id}_${timestamp}.webm`;
    
    // Upload to storage
    const { error: uploadError } = await supabase
      .storage
      .from('field-audio')
      .upload(filename, audio_file, {
        contentType: 'audio/webm',
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw new Error(`Failed to upload audio: ${uploadError.message}`);
    }

    // Create field report record with text_note
    const { data, error } = await supabase
      .from('field_reports')
      .insert({
        event_id,
        sector_id,
        actor_id: actorId,
        audio_url: `field-audio/${filename}`,
        text_note: text_note || null,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      console.error('Insert error:', error);
      throw new Error(`Failed to create report: ${error.message}`);
    }

    return toFieldReport(data);
  },

  /**
   * Create a text-only field report and process it with AI extraction
   */
  async createTextOnlyReport(params: {
    event_id: string;
    sector_id: string;
    text_note: string;
  }, actorId: string): Promise<FieldReport> {
    const { data, error } = await supabase.functions.invoke('extract-text-report', {
      body: { 
        ...params, 
        actor_id: actorId 
      },
    });

    if (error) {
      console.error('Text extraction error:', error);
      throw new Error(`Text extraction failed: ${error.message}`);
    }

    if (!data.success || !data.report) {
      throw new Error(data.error || 'Unknown error processing text report');
    }

    return toFieldReport(data.report);
  },

  /**
   * Trigger transcription via edge function
   */
  async triggerTranscription(reportId: string): Promise<{ success: boolean; transcript?: string; extracted_data?: ExtractedData }> {
    const { data, error } = await supabase.functions.invoke('transcribe-field-report', {
      body: { report_id: reportId },
    });

    if (error) {
      console.error('Transcription error:', error);
      throw new Error(`Transcription failed: ${error.message}`);
    }

    return data;
  },

  /**
   * Get report by ID for status polling
   */
  async getReport(reportId: string): Promise<FieldReport | null> {
    const { data, error } = await supabase
      .from('field_reports')
      .select('*')
      .eq('id', reportId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return toFieldReport(data);
  },

  /**
   * Get all reports for a specific actor
   */
  async getMyReports(actorId: string): Promise<FieldReport[]> {
    const { data, error } = await supabase
      .from('field_reports')
      .select('*')
      .eq('actor_id', actorId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(toFieldReport);
  },

  /**
   * Get reports for a specific deployment (event + sector combination)
   */
  async getReportsForDeployment(eventId: string, sectorId: string, actorId: string): Promise<FieldReport[]> {
    const { data, error } = await supabase
      .from('field_reports')
      .select('*')
      .eq('event_id', eventId)
      .eq('sector_id', sectorId)
      .eq('actor_id', actorId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) throw error;
    return (data || []).map(toFieldReport);
  },

  /**
   * Poll for status updates until completed or failed
   */
  async pollStatus(reportId: string, onUpdate: (report: FieldReport) => void, maxAttempts = 60): Promise<FieldReport> {
    let attempts = 0;
    
    return new Promise((resolve, reject) => {
      const poll = async () => {
        attempts++;
        
        try {
          const report = await this.getReport(reportId);
          
          if (!report) {
            reject(new Error('Report not found'));
            return;
          }

          onUpdate(report);

          if (report.status === 'completed' || report.status === 'failed') {
            resolve(report);
            return;
          }

          if (attempts >= maxAttempts) {
            reject(new Error('Polling timeout'));
            return;
          }

          // Poll every 2 seconds
          setTimeout(poll, 2000);
        } catch (error) {
          reject(error);
        }
      };

      poll();
    });
  },
};
