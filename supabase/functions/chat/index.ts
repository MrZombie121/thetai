import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    const MAX_MESSAGES = 50;
    const MESSAGE_SIZE_BYTES = 10240; // 10 KB per message

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid messages array' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (messages.length > MAX_MESSAGES) {
      return new Response(
        JSON.stringify({ error: 'Too many messages' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    for (const msg of messages) {
      if (typeof msg.content === 'string' && msg.content.length > MAX_MESSAGE_LENGTH) {
        return new Response(
          JSON.stringify({ error: 'Message too long' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Get authorization header and check user limits
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Extract JWT token and get user
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: userError } = await supabase.auth.getUser(token);

      if (user && !userError) {
        // Check if user can send message
        const { data: limitCheck, error: limitError } = await supabase
          .rpc('can_user_send_message', { _user_id: user.id });

        if (limitError) {
          console.error('Error checking message limits:', limitError);
        } else if (limitCheck && !limitCheck.allowed) {
          if (limitCheck.reason === 'rate_limit') {
            return new Response(JSON.stringify({ 
              error: 'rate_limit_exceeded',
              message: 'Лимит сообщений исчерпан. Доступно 15 сообщений за 4 часа на бесплатном тарифе.',
              messages_remaining: 0,
              reset_hours: 4
            }), {
              status: 429,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          if (limitCheck.reason === 'storage_limit') {
            return new Response(JSON.stringify({ 
              error: 'storage_limit_exceeded',
              message: 'Лимит хранилища исчерпан. На бесплатном тарифе доступно 2 ГБ.',
              storage_used: limitCheck.storage_used_bytes,
              storage_limit: limitCheck.storage_limit_bytes
            }), {
              status: 429,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        }

        // Increment storage usage after successful message
        await supabase.rpc('increment_storage_usage', { 
          _user_id: user.id, 
          _bytes: MESSAGE_SIZE_BYTES 
        });

        console.log('User limits check passed, messages remaining:', limitCheck?.messages_remaining);
      }
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log('Processing chat request with', messages.length, 'messages');

    // Build messages array with image support
    const formattedMessages = messages.map((msg: any) => {
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
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are ThetAI - a friendly and intelligent AI assistant.

CRITICAL RULE: You MUST detect the language of the user's message and respond ONLY in that same language.
- If the user writes in English → respond in English
- If the user writes in Russian → respond in Russian (отвечай на русском)
- If the user writes in Ukrainian → respond in Ukrainian (відповідай українською)
- If the user writes in any other language → respond in that language

Your qualities:
- You are always polite and ready to help
- You respond in a structured and clear manner
- You use Markdown for formatting (lists, code, highlighting)
- You can analyze images if attached
- You give practical and accurate answers
- You ask clarifying questions when needed

Never mention that you are based on Gemini or Google. Introduce yourself as ThetAI.`
          },
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
