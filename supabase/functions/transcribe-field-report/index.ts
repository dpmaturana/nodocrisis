import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EXTRACTION_PROMPT = `You are an emergency analysis assistant that processes field reports (may include written notes and/or audio transcription).

Extract the following structured information by combining ALL sources of information:

1. sector_mentioned: Name of the sector or location mentioned (string or null)
2. capability_types: Array of detected capability types. Use EXACTLY these system names: {{CAPABILITY_LIST}}
3. items: Array of objects with:
   - name: item/resource name
   - quantity: mentioned quantity (number or null)
   - unit: unit (e.g., "liters", "people", "units")
   - state: current state ("available", "needed", "in_transit", "depleted")
   - urgency: urgency level ("low", "medium", "high", "critical")
4. location_detail: More specific location description within the sector
5. observations: Brief summary (1-2 sentences) in English of the situation that will be visible to other actors. MUST capture the essence of the report clearly and actionably, combining information from written notes and transcription.
6. evidence_quotes: Array of relevant verbatim quotes
7. confidence: Confidence level in the extraction (0.0 to 1.0)

IMPORTANT: Analyze BOTH the written note and the audio transcription. Extract capability_types from BOTH sources. Use ONLY the exact names from the provided list. ALL output text must be in English, regardless of input language.

Respond ONLY with valid JSON, no markdown or explanations.`;

interface ExtractedData {
  sector_mentioned: string | null;
  capability_types: string[];
  items: Array<{
    name: string;
    quantity: number | null;
    unit: string;
    state: string;
    urgency: string;
  }>;
  location_detail: string | null;
  observations: string | null;
  evidence_quotes: string[];
  confidence: number;
}

/** Pick the highest urgency from extracted items; default to "medium". */
function deriveNeedLevel(items: ExtractedData["items"]): string {
  const rank: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
  let best: string | null = null;
  let bestRank = 0;
  for (const item of items) {
    const r = rank[item.urgency] ?? 0;
    if (r > bestRank) { bestRank = r; best = item.urgency; }
  }
  return best ?? "medium";
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { report_id } = await req.json();

    if (!report_id) {
      return new Response(
        JSON.stringify({ error: 'report_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with service role for full access
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the field report
    const { data: report, error: reportError } = await supabase
      .from('field_reports')
      .select('*')
      .eq('id', report_id)
      .single();

    if (reportError || !report) {
      console.error('Error fetching report:', reportError);
      return new Response(
        JSON.stringify({ error: 'Report not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update status to transcribing
    await supabase
      .from('field_reports')
      .update({ status: 'transcribing', updated_at: new Date().toISOString() })
      .eq('id', report_id);

    // Download audio from storage
    const audioPath = report.audio_url.replace('field-audio/', '');
    const { data: audioData, error: downloadError } = await supabase
      .storage
      .from('field-audio')
      .download(audioPath);

    if (downloadError || !audioData) {
      console.error('Error downloading audio:', downloadError);
      await supabase
        .from('field_reports')
        .update({ 
          status: 'failed', 
          error_message: 'Failed to download audio file',
          updated_at: new Date().toISOString() 
        })
        .eq('id', report_id);
      
      return new Response(
        JSON.stringify({ error: 'Failed to download audio' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Transcribe with ElevenLabs
    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
    if (!ELEVENLABS_API_KEY) {
      throw new Error('ELEVENLABS_API_KEY not configured');
    }

    const formData = new FormData();
    formData.append('file', audioData, 'audio.webm');
    formData.append('model_id', 'scribe_v2');
    formData.append('language_code', 'spa'); // Spanish

    console.log('Calling ElevenLabs STT...');
    const transcribeResponse = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
      },
      body: formData,
    });

    if (!transcribeResponse.ok) {
      const errorText = await transcribeResponse.text();
      console.error('ElevenLabs error:', errorText);
      await supabase
        .from('field_reports')
        .update({ 
          status: 'failed', 
          error_message: `Transcription failed: ${transcribeResponse.status}`,
          updated_at: new Date().toISOString() 
        })
        .eq('id', report_id);
      
      return new Response(
        JSON.stringify({ error: 'Transcription failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const transcription = await transcribeResponse.json();
    const transcript = transcription.text || '';
    console.log('Transcript:', transcript);

    if (!transcript.trim()) {
      await supabase
        .from('field_reports')
        .update({ 
          status: 'failed', 
          error_message: 'No speech detected in audio',
          updated_at: new Date().toISOString() 
        })
        .eq('id', report_id);
      
      return new Response(
        JSON.stringify({ error: 'No speech detected' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update status to extracting
    await supabase
      .from('field_reports')
      .update({ 
        status: 'extracting', 
        transcript,
        updated_at: new Date().toISOString() 
      })
      .eq('id', report_id);

    // Extract structured data using Lovable AI Gateway
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Fetch standardized capability names from DB
    const { data: capTypes } = await supabase
      .from('capacity_types')
      .select('id, name');
    const capList = capTypes && capTypes.length > 0
      ? capTypes.map((c: { id: string; name: string }) => `"${c.name}"`).join(', ')
      : '"water","food","shelter","health","communications","rescue","logistics","energy"';

    // Inject dynamic capability list into prompt
    const finalExtractionPrompt = EXTRACTION_PROMPT.replace('{{CAPABILITY_LIST}}', capList);

    // Combine text_note and transcript for LLM analysis
    const textNote = report.text_note || '';
    const combinedInput = [
      textNote ? `Operator written note: "${textNote}"` : null,
      transcript ? `Audio transcription: "${transcript}"` : null,
    ].filter(Boolean).join('\n\n');

    console.log('Calling LLM for extraction with combined input...');
    console.log('Text note:', textNote);
    console.log('Transcript:', transcript);
    
    const extractResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: finalExtractionPrompt },
          { role: 'user', content: `Field report:\n\n${combinedInput}` }
        ],
        temperature: 0.2,
      }),
    });

    if (!extractResponse.ok) {
      const errorText = await extractResponse.text();
      console.error('LLM extraction error:', errorText);
      // Still save the transcript even if extraction fails
      await supabase
        .from('field_reports')
        .update({ 
          status: 'completed',
          transcript,
          extracted_data: null,
          error_message: 'Extraction failed but transcript saved',
          updated_at: new Date().toISOString() 
        })
        .eq('id', report_id);
      
      return new Response(
        JSON.stringify({ success: true, transcript, extracted_data: null }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const extractResult = await extractResponse.json();
    let extractedData: ExtractedData | null = null;

    try {
      const content = extractResult.choices?.[0]?.message?.content || '';
      // Clean up potential markdown fences
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      extractedData = JSON.parse(cleanContent);
      console.log('Extracted data:', extractedData);
    } catch (parseError) {
      console.error('Failed to parse extraction:', parseError);
    }

    // Save completed report
    await supabase
      .from('field_reports')
      .update({ 
        status: 'completed',
        transcript,
        extracted_data: extractedData,
        error_message: null,
        updated_at: new Date().toISOString() 
      })
      .eq('id', report_id);

    // Create signal(s) if we have extracted data with content
    if (extractedData && transcript) {
      const signalContent = extractedData.observations || transcript.substring(0, 500);

      // Build a map of capacity type name (lowercase) → id for fast lookup
      const capTypeMap = new Map(
        (capTypes ?? []).map((c: { id: string; name: string }) => [c.name.toLowerCase(), c.id])
      );

      // Map extracted capability_types to capacity_type_ids
      const linkedCapabilities = (extractedData.capability_types ?? [])
        .map((name: string) => capTypeMap.get(name.toLowerCase()))
        .filter((id): id is string => id != null);

      if (linkedCapabilities.length > 0) {
        // Create one signal per detected capacity type so the gap engine can
        // attribute evidence to the correct capability.
        await supabase
          .from('signals')
          .insert(
            linkedCapabilities.map((capTypeId: string) => ({
              event_id: report.event_id,
              sector_id: report.sector_id,
              signal_type: 'field_report',
              level: 'sector',
              content: signalContent,
              source: 'audio_transcription',
              confidence: extractedData.confidence || 0.7,
              field_report_id: report_id,
              capacity_type_id: capTypeId,
            }))
          );
        console.log(`${linkedCapabilities.length} signal(s) created for report:`, report_id);

        // Upsert sector_needs_context so the gap engine can see the need
        const needLevel = deriveNeedLevel(extractedData.items ?? []);
        for (const capTypeId of linkedCapabilities) {
          const { error: needError } = await supabase
            .from('sector_needs_context')
            .upsert(
              {
                event_id: report.event_id,
                sector_id: report.sector_id,
                capacity_type_id: capTypeId,
                level: needLevel,
                source: 'field_report',
                notes: extractedData.observations || null,
                created_by: null,
                expires_at: null,
              },
              { onConflict: 'event_id,sector_id,capacity_type_id' },
            );
          if (needError) {
            console.error('sector_needs_context upsert error:', needError);
          }
        }
        console.log(`${linkedCapabilities.length} sector_needs_context row(s) upserted (level: ${needLevel})`);
      } else {
        // Fallback: create a generic signal without capacity_type_id
        await supabase
          .from('signals')
          .insert({
            event_id: report.event_id,
            sector_id: report.sector_id,
            signal_type: 'field_report',
            level: 'sector',
            content: signalContent,
            source: 'audio_transcription',
            confidence: extractedData.confidence || 0.7,
            field_report_id: report_id,
          });
        console.log('Generic signal created for report (no capability types detected):', report_id);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        transcript, 
        extracted_data: extractedData 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in transcribe-field-report:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
