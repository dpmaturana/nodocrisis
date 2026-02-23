import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EXTRACTION_PROMPT = `You are a humanitarian field report analysis assistant.
Your task is to extract structured information from a field report that may include written notes and/or audio transcription.

Extract the following information and return ONLY a valid JSON object:

{
  "capabilities": [
    {
      "name": string,                  // Exact capability name from the system list: {{CAPABILITY_LIST}}
      "sentiment": "improving" | "worsening" | "stable" | "unknown",
      "items": [
        {
          "name": string,              // Item/resource name
          "quantity": number | null,   // Quantity if mentioned
          "unit": string,              // Unit (people, liters, kg, units, etc.)
          "state": "available" | "needed" | "in_transit" | "depleted",
          "urgency": "low" | "medium" | "high" | "critical"
        }
      ],
      "observation": string,           // 1-2 sentence summary specific to THIS capability (max 200 chars) in English
      "evidence_quotes": string[]      // Relevant verbatim quotes for THIS capability
    }
  ],
  "sector_mentioned": string | null,   // Name of the sector/zone mentioned
  "location_detail": string | null,    // Specific location details
  "observations": string | null,       // Public 1-2 sentence OVERALL summary (max 200 chars) in English
  "confidence": number                 // 0.0-1.0 how confident you are in the extraction
}

IMPORTANT:
- Group ALL extracted information BY CAPABILITY. Each capability gets its own items, observation, and evidence.
- "sentiment" reflects the DIRECTION for that capability: "improving" if the situation is getting better, "worsening" if deteriorating, "stable" if unchanged, "unknown" if unclear.
- Each capability's "observation" must describe ONLY what happened for THAT capability, not a general summary.
- The top-level "observations" is a brief overall summary of the entire report.
- Analyze BOTH the written note and the audio transcription. Extract capabilities from BOTH sources.
- If something is not mentioned, use null or empty array
- Be conservative with urgency: only "critical" if there is immediate danger to life
- Use ONLY the exact names from the provided list for capability names
- ALL output text must be in English, regardless of input language`;

interface CapabilityExtraction {
  name: string;
  sentiment: "improving" | "worsening" | "stable" | "unknown";
  items: Array<{
    name: string;
    quantity: number | null;
    unit: string;
    state: string;
    urgency: string;
  }>;
  observation: string;
  evidence_quotes: string[];
}

interface ExtractedData {
  capabilities: CapabilityExtraction[];
  // Backward compat fields (derived)
  capability_types: string[];
  items: Array<{
    name: string;
    quantity: number | null;
    unit: string;
    state: string;
    urgency: string;
  }>;
  sector_mentioned: string | null;
  location_detail: string | null;
  observations: string | null;
  evidence_quotes: string[];
  confidence: number;
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
      const rawParsed = JSON.parse(cleanContent);

      // Normalize to ExtractedData with backward-compat fields
      if (rawParsed && Array.isArray(rawParsed.capabilities) && rawParsed.capabilities.length > 0) {
        const capabilities: CapabilityExtraction[] = rawParsed.capabilities;
        extractedData = {
          capabilities,
          capability_types: capabilities.map((c) => c.name),
          items: capabilities.flatMap((c) => c.items || []),
          sector_mentioned: rawParsed.sector_mentioned ?? null,
          location_detail: rawParsed.location_detail ?? null,
          observations: rawParsed.observations ?? null,
          evidence_quotes: capabilities.flatMap((c) => c.evidence_quotes || []),
          confidence: rawParsed.confidence ?? 0.5,
        };
      } else if (rawParsed) {
        extractedData = {
          capabilities: [],
          capability_types: rawParsed.capability_types ?? [],
          items: rawParsed.items ?? [],
          sector_mentioned: rawParsed.sector_mentioned ?? null,
          location_detail: rawParsed.location_detail ?? null,
          observations: rawParsed.observations ?? transcript.substring(0, 200),
          evidence_quotes: rawParsed.evidence_quotes ?? [],
          confidence: rawParsed.confidence ?? 0.5,
        };
      } else {
        extractedData = {
          capabilities: [],
          capability_types: [],
          items: [],
          sector_mentioned: null,
          location_detail: null,
          observations: transcript.substring(0, 200),
          evidence_quotes: [transcript],
          confidence: 0.3,
        };
      }
      console.log('Extracted data:', JSON.stringify(extractedData));
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
      // Build a map of capacity type name (lowercase) → id for fast lookup
      const capTypeMap = new Map(
        (capTypes ?? []).map((c: { id: string; name: string }) => [c.name.toLowerCase(), c.id])
      );

      if (extractedData.capabilities && extractedData.capabilities.length > 0) {
        // New path: one signal per capability with capability-specific observation
        const signalRows = extractedData.capabilities
          .map((cap) => {
            const capId = capTypeMap.get(cap.name.toLowerCase());
            if (!capId || !cap.observation) return null;
            return {
              event_id: report.event_id,
              sector_id: report.sector_id,
              signal_type: 'field_report',
              level: 'sector',
              content: cap.observation,
              source: 'audio_transcription',
              confidence: extractedData!.confidence || 0.7,
              field_report_id: report_id,
              capacity_type_id: capId,
            };
          })
          .filter(Boolean);

        if (signalRows.length > 0) {
          const { error: signalError } = await supabase.from('signals').insert(signalRows);
          if (signalError) {
            console.error('Signal creation error:', signalError);
          } else {
            console.log(`${signalRows.length} per-capability signal(s) created for report:`, report_id);
          }
        }
      } else {
        // Fallback: old flat path
        const signalContent = extractedData.observations || transcript.substring(0, 500);
        const linkedCapabilities = (extractedData.capability_types ?? [])
          .map((name: string) => capTypeMap.get(name.toLowerCase()))
          .filter((id): id is string => id != null);

        if (linkedCapabilities.length > 0) {
          await supabase.from('signals').insert(
            linkedCapabilities.map((capTypeId: string) => ({
              event_id: report.event_id,
              sector_id: report.sector_id,
              signal_type: 'field_report',
              level: 'sector',
              content: signalContent,
              source: 'audio_transcription',
              confidence: extractedData!.confidence || 0.7,
              field_report_id: report_id,
              capacity_type_id: capTypeId,
            }))
          );
          console.log(`${linkedCapabilities.length} signal(s) created (flat fallback) for report:`, report_id);
        } else {
          await supabase.from('signals').insert({
            event_id: report.event_id,
            sector_id: report.sector_id,
            signal_type: 'field_report',
            level: 'sector',
            content: signalContent,
            source: 'audio_transcription',
            confidence: extractedData!.confidence || 0.7,
            field_report_id: report_id,
          });
          console.log('Generic signal created for report (no capability types detected):', report_id);
        }
      }

      // Delegate to NeedLevelEngine
      const processSignalsUrl = Deno.env.get('PROCESS_FIELD_REPORT_SIGNALS_URL')
        || `${supabaseUrl}/functions/v1/process-field-report-signals`;
      const capacityTypeMap: Record<string, string> = {};
      for (const ct of (capTypes ?? [])) {
        capacityTypeMap[(ct as { id: string; name: string }).name] = (ct as { id: string; name: string }).id;
      }
      const engineResponse = await fetch(processSignalsUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          event_id: report.event_id,
          sector_id: report.sector_id,
          extracted_data: extractedData,
          capacity_type_map: capacityTypeMap,
          report_id,
        }),
      });
      if (!engineResponse.ok) {
        console.error('[engine path] process-field-report-signals error:', await engineResponse.text());
      } else {
        const engineResult = await engineResponse.json();
        console.log('[engine path] NeedLevelEngine results:', JSON.stringify(engineResult));
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
