import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerifyOtpRequest {
  email: string;
  code: string;
}

const MAX_VERIFY_ATTEMPTS_PER_HOUR = 10;

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 255;
}

function isValidCode(code: string): boolean {
  return /^\d{6}$/.test(code);
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { email, code } = body as VerifyOtpRequest;
    
    // Input validation
    if (!email || !isValidEmail(email)) {
      console.log("Invalid email format:", email);
      return new Response(
        JSON.stringify({ valid: false, error: 'Invalid email format' }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    
    if (!code || !isValidCode(code)) {
      console.log("Invalid code format:", code);
      return new Response(
        JSON.stringify({ valid: false, error: 'Invalid code format' }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    
    console.log(`Verifying OTP for ${email}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Rate limiting check
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count, error: countError } = await supabase
      .from('otp_attempts')
      .select('*', { count: 'exact', head: true })
      .eq('email', email.toLowerCase())
      .eq('attempt_type', 'verify')
      .gte('created_at', oneHourAgo);

    if (countError) {
      console.error("Error checking rate limit:", countError);
    }

    if (count && count >= MAX_VERIFY_ATTEMPTS_PER_HOUR) {
      console.log(`Rate limit exceeded for ${email}: ${count} verification attempts in last hour`);
      return new Response(
        JSON.stringify({ valid: false, error: 'Too many verification attempts. Please try again later.' }),
        { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Record this attempt
    await supabase.from('otp_attempts').insert({
      email: email.toLowerCase(),
      attempt_type: 'verify'
    });

    // Find valid OTP
    const { data: otpRecord, error: findError } = await supabase
      .from('otp_codes')
      .select('*')
      .eq('email', email.toLowerCase())
      .eq('code', code)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (findError || !otpRecord) {
      console.log("OTP not found or expired:", findError);
      return new Response(
        JSON.stringify({ valid: false, error: 'Invalid or expired code' }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Mark OTP as used
    await supabase
      .from('otp_codes')
      .update({ used: true })
      .eq('id', otpRecord.id);

    console.log("OTP verified successfully");

    return new Response(
      JSON.stringify({ valid: true, type: otpRecord.type }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in verify-otp function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
