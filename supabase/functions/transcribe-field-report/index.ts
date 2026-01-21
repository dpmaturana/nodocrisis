import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EXTRACTION_PROMPT = `Eres un asistente de emergencias que analiza transcripciones de reportes de campo.

Extrae la siguiente información estructurada del texto:

1. sector_mentioned: Nombre del sector o ubicación mencionada (string o null)
2. capability_types: Array de tipos de capacidad detectados. Valores válidos: "agua", "alimentos", "albergue", "salud", "transporte", "comunicaciones", "rescate", "logística"
3. items: Array de objetos con:
   - name: nombre del item/recurso
   - quantity: cantidad mencionada (number o null)
   - unit: unidad (ej: "litros", "personas", "unidades")
   - state: estado actual ("disponible", "necesario", "en_camino", "agotado")
   - urgency: nivel de urgencia ("baja", "media", "alta", "crítica")
4. location_detail: Descripción más específica de la ubicación dentro del sector
5. observations: Observaciones generales del reporte
6. evidence_quotes: Array de citas textuales relevantes del transcript
7. confidence: Nivel de confianza en la extracción (0.0 a 1.0)

Responde SOLO con JSON válido, sin markdown ni explicaciones.`;

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

    console.log('Calling LLM for extraction...');
    const extractResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: EXTRACTION_PROMPT },
          { role: 'user', content: `Transcripción del reporte de campo:\n\n"${transcript}"` }
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

    // Create signal if we have extracted data with content
    if (extractedData && transcript) {
      const signalContent = extractedData.observations || transcript.substring(0, 500);
      
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
      
      console.log('Signal created for report:', report_id);
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
