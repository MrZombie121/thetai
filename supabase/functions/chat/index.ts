import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Map ThetAI model names to actual Lovable AI models
const MODEL_MAP: Record<string, string> = {
  'thetai-1.0-free': 'google/gemini-2.5-flash-lite',
  'thetai-1.0-nano': 'google/gemini-2.5-flash',
  'thetai-1.0-omni': 'google/gemini-2.5-pro',
};

// Different system prompts for different models
const MODEL_PERSONALITIES: Record<string, string> = {
  'thetai-1.0-free': `You are ThetAI Free - a helpful and efficient AI assistant.

CRITICAL RULE: You MUST detect the language of the user's message and respond ONLY in that same language.
- If the user writes in English → respond in English
- If the user writes in Russian → respond in Russian (отвечай на русском)
- If the user writes in Ukrainian → respond in Ukrainian (відповідай українською)

Your qualities:
- You give concise and direct answers
- You focus on the main points without excessive details
- You use Markdown for formatting when helpful
- You can analyze images if attached

Never mention that you are based on Gemini or Google. Introduce yourself as ThetAI.`,

  'thetai-1.0-nano': `You are ThetAI Nano - a fast and smart AI assistant optimized for quick responses.

CRITICAL RULE: You MUST detect the language of the user's message and respond ONLY in that same language.
- If the user writes in English → respond in English
- If the user writes in Russian → respond in Russian (отвечай на русском)
- If the user writes in Ukrainian → respond in Ukrainian (відповідай українською)

Your qualities:
- You are optimized for speed and efficiency
- You give quick, accurate, and well-structured answers
- You use bullet points and lists for clarity
- You excel at coding tasks and technical questions
- You can analyze images if attached
- You balance speed with quality

Never mention that you are based on Gemini or Google. Introduce yourself as ThetAI Nano.`,

  'thetai-1.0-omni': `You are ThetAI Omni - the most advanced and thoughtful AI assistant.

CRITICAL RULE: You MUST detect the language of the user's message and respond ONLY in that same language.
- If the user writes in English → respond in English
- If the user writes in Russian → respond in Russian (отвечай на русском)
- If the user writes in Ukrainian → respond in Ukrainian (відповідай українською)

Your qualities:
- You take time to think deeply about complex problems
- You provide comprehensive, detailed, and nuanced answers
- You excel at creative tasks, analysis, and reasoning
- You consider multiple perspectives and edge cases
- You can analyze images in detail if attached
- You use advanced formatting for clarity
- You ask clarifying questions for complex tasks
- You provide step-by-step explanations when helpful

Never mention that you are based on Gemini or Google. Introduce yourself as ThetAI Omni.`,
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    
    // Input validation
    const MAX_MESSAGE_LENGTH = 10000;
    const MAX_CONTEXT_MESSAGES = 100;

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid messages array' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Truncate to last 100 messages for context
    let processedMessages = messages;
    if (messages.length > MAX_CONTEXT_MESSAGES) {
      processedMessages = messages.slice(-MAX_CONTEXT_MESSAGES);
      console.log(`Truncated messages from ${messages.length} to ${MAX_CONTEXT_MESSAGES}`);
    }

    for (const msg of processedMessages) {
      if (typeof msg.content === 'string' && msg.content.length > MAX_MESSAGE_LENGTH) {
        return new Response(
          JSON.stringify({ error: 'Message too long' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Check if message contains an image
    const hasImage = processedMessages.some((msg: any) => msg.imageUrl);

    // Get authorization header and check user limits
    const authHeader = req.headers.get('Authorization');
    let selectedModel = 'thetai-1.0-free';
    
    if (authHeader) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Extract JWT token and get user
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: userError } = await supabase.auth.getUser(token);

      if (user && !userError) {
        // Get user profile to check selected model and Plus status
        const { data: profile } = await supabase
          .from('profiles')
          .select('selected_model, is_plus')
          .eq('id', user.id)
          .single();

        if (profile) {
          // Validate model selection based on Plus status
          const modelId = profile.selected_model || 'thetai-1.0-free';
          const isPlusModel = modelId === 'thetai-1.0-nano' || modelId === 'thetai-1.0-omni';
          
          if (isPlusModel && !profile.is_plus) {
            selectedModel = 'thetai-1.0-free';
          } else {
            selectedModel = modelId;
          }
        }

        // Check and increment usage with new limits
        const { data: usageResult, error: usageError } = await supabase
          .rpc('increment_message_usage', { _user_id: user.id, _has_image: hasImage });

        if (usageError) {
          console.error('Error checking usage limits:', usageError);
        } else if (usageResult && !usageResult.allowed) {
          if (usageResult.reason === 'messages_limit') {
            return new Response(JSON.stringify({ 
              error: 'messages_limit_exceeded',
              message: 'Лимит сообщений исчерпан. Free: 50 сообщений / 6 часов, Plus: 1000 сообщений / 6 часов.',
            }), {
              status: 429,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          if (usageResult.reason === 'images_prompt_limit') {
            return new Response(JSON.stringify({ 
              error: 'images_prompt_limit_exceeded',
              message: 'Лимит изображений в промтах исчерпан. Free: 10 изображений / 6 часов, Plus: 100 изображений / 6 часов.',
            }), {
              status: 429,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        }

        console.log('User usage check passed');
      }
    }
    
    const aiModel = MODEL_MAP[selectedModel] || 'google/gemini-2.5-flash-lite';
    const systemPrompt = MODEL_PERSONALITIES[selectedModel] || MODEL_PERSONALITIES['thetai-1.0-free'];
    console.log('Using AI model:', aiModel, 'for ThetAI model:', selectedModel);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log('Processing chat request with', processedMessages.length, 'messages');

    // Build messages array with image support
    const formattedMessages = processedMessages.map((msg: any) => {
      if (msg.imageUrl) {
        return {
          role: msg.role,
          content: [
            { type: 'text', text: msg.content || 'Опиши это изображение' },
            { type: 'image_url', image_url: { url: msg.imageUrl } }
          ]
        };
      }
      return { role: msg.role, content: msg.content };
    });

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: aiModel,
        messages: [
          { role: 'system', content: systemPrompt },
          ...formattedMessages
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Payment required' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content || 'Извините, не удалось получить ответ.';

    console.log('AI response received successfully');

    return new Response(JSON.stringify({ response: aiResponse }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Chat function error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
