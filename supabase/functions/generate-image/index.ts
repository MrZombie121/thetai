import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Add watermark to base64 image using canvas
async function addWatermark(base64Image: string): Promise<string> {
  const { createCanvas, loadImage } = await import("https://deno.land/x/canvas@v1.4.2/mod.ts");
  
  // Remove data URL prefix if present
  const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
  
  // Decode base64 to Uint8Array
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  // Load the image
  const image = await loadImage(bytes);
  const width = image.width();
  const height = image.height();
  
  // Create canvas with image dimensions
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  
  // Draw the original image
  ctx.drawImage(image, 0, 0);
  
  // Configure watermark style
  const fontSize = Math.max(28, Math.min(width, height) * 0.06);
  ctx.font = `bold ${fontSize}px sans-serif`;
  
  const watermarkText = 'ThetAI';
  const metrics = ctx.measureText(watermarkText);
  const textWidth = metrics.width;
  const padding = 20;
  
  // Position in bottom-right corner
  const x = width - textWidth - padding;
  const y = height - padding;
  
  // Draw shadow/outline for visibility
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillText(watermarkText, x + 2, y + 2);
  
  // Draw main text
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.fillText(watermarkText, x, y);
  
  // Convert to PNG buffer
  const buffer = canvas.toBuffer('image/png');
  
  // Convert buffer to base64
  const uint8Array = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < uint8Array.length; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  const watermarkedBase64 = btoa(binary);
  
  return `data:image/png;base64,${watermarkedBase64}`;
}

serve(async (req) => {
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
        message: `Лимит генерации изображений исчерпан. Free: 5/день, Plus: 15/день. Обновится: ${resetsAt}`,
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
            content: prompt
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
      
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log('Image generation response received');

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
    let finalImageUrl = imageUrl;

    // Add watermark
    try {
      console.log('Adding watermark to image...');
      finalImageUrl = await addWatermark(imageUrl);
      console.log('Watermark added successfully');
    } catch (watermarkError) {
      console.error('Failed to add watermark:', watermarkError);
      finalImageUrl = imageUrl;
    }

    // Save to storage and database
    try {
      const base64Data = finalImageUrl.replace(/^data:image\/\w+;base64,/, '');
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const fileName = `${user.id}/${Date.now()}.png`;
      
      const { error: uploadError } = await supabase.storage
        .from('generated-images')
        .upload(fileName, bytes, {
          contentType: 'image/png',
          upsert: false
        });

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
      } else {
        const { data: publicUrlData } = supabase.storage
          .from('generated-images')
          .getPublicUrl(fileName);

        const storedImageUrl = publicUrlData.publicUrl;

        // Save to database
        const { error: dbError } = await supabase
          .from('generated_images')
          .insert({
            user_id: user.id,
            prompt: prompt,
            image_url: storedImageUrl,
            description: textContent
          });

        if (dbError) {
          console.error('Database insert error:', dbError);
        } else {
          console.log('Image saved to library');
          finalImageUrl = storedImageUrl;
        }
      }
    } catch (saveError) {
      console.error('Failed to save image to library:', saveError);
    }

    return new Response(JSON.stringify({ 
      imageUrl: finalImageUrl,
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
