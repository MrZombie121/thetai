import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Add watermark to base64 image
async function addWatermark(base64Image: string): Promise<string> {
  // Import canvas library for Deno
  const { createCanvas, loadImage } = await import("https://deno.land/x/canvas@v1.4.2/mod.ts");
  
  // Remove data URL prefix if present
  const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
  
  // Decode base64 to Uint8Array
  const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
  
  // Load the image
  const image = await loadImage(imageBytes);
  
  // Create canvas with image dimensions
  const canvas = createCanvas(image.width(), image.height());
  const ctx = canvas.getContext('2d');
  
  // Draw the original image
  ctx.drawImage(image, 0, 0);
  
  // Configure watermark style
  const fontSize = Math.max(24, Math.min(image.width(), image.height()) * 0.05);
  ctx.font = `bold ${fontSize}px Arial`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.lineWidth = 2;
  
  // Position watermark in bottom-right corner
  const watermarkText = 'ThetAI';
  const textMetrics = ctx.measureText(watermarkText);
  const x = image.width() - textMetrics.width - 20;
  const y = image.height() - 20;
  
  // Draw watermark with outline for visibility
  ctx.strokeText(watermarkText, x, y);
  ctx.fillText(watermarkText, x, y);
  
  // Convert back to base64
  const watermarkedBuffer = canvas.toBuffer('image/png');
  const watermarkedBase64 = btoa(String.fromCharCode(...new Uint8Array(watermarkedBuffer)));
  
  return `data:image/png;base64,${watermarkedBase64}`;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt } = await req.json();
    
    if (!prompt || typeof prompt !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Prompt is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (prompt.length > 2000) {
      return new Response(
        JSON.stringify({ error: 'Prompt too long (max 2000 characters)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get authorization header and check user limits
    const authHeader = req.headers.get('Authorization');
    
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Extract JWT token and get user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (!user || userError) {
      return new Response(
        JSON.stringify({ error: 'Invalid user' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check and increment image generation usage
    const { data: usageResult, error: usageError } = await supabase
      .rpc('increment_image_gen_usage', { _user_id: user.id });

    if (usageError) {
      console.error('Error checking usage limits:', usageError);
      return new Response(
        JSON.stringify({ error: 'Failed to check usage limits' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (usageResult && !usageResult.allowed) {
      const resetsAt = usageResult.resets_at ? new Date(usageResult.resets_at).toLocaleString('ru-RU') : 'скоро';
      return new Response(JSON.stringify({ 
        error: 'images_gen_limit_exceeded',
        message: `Лимит генерации изображений исчерпан. Free: 5 изображений / день, Plus: 15 изображений / день. Обновится: ${resetsAt}`,
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log('Generating image with prompt:', prompt.substring(0, 100));

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-image-preview',
        messages: [
          {
            role: 'user',
            content: `Generate an image based on this description: ${prompt}`
          }
        ],
        modalities: ['image', 'text']
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
    console.log('Image generation response received');

    // Extract image from response
    const message = data.choices?.[0]?.message;
    const images = message?.images;
    const textContent = message?.content || '';

    if (!images || images.length === 0) {
      return new Response(JSON.stringify({ 
        error: 'No image generated',
        message: textContent || 'Не удалось сгенерировать изображение. Попробуйте другой промт.'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let imageUrl = images[0]?.image_url?.url;

    // Add watermark to the image
    try {
      console.log('Adding watermark to image...');
      imageUrl = await addWatermark(imageUrl);
      console.log('Watermark added successfully');
    } catch (watermarkError) {
      console.error('Failed to add watermark:', watermarkError);
      // Continue with original image if watermark fails
    }

    return new Response(JSON.stringify({ 
      imageUrl,
      description: textContent 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Image generation error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});