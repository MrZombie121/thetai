import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendOtpRequest {
  email: string;
  type: 'signup' | 'login';
}

const MAX_SEND_ATTEMPTS_PER_HOUR = 5;

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 255;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { email, type } = body as SendOtpRequest;
    
    // Input validation
    if (!email || !isValidEmail(email)) {
      console.log("Invalid email format:", email);
      return new Response(
        JSON.stringify({ error: 'Invalid email format' }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    
    if (!type || !['signup', 'login'].includes(type)) {
      console.log("Invalid type:", type);
      return new Response(
        JSON.stringify({ error: 'Invalid request type' }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Rate limiting check
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count, error: countError } = await supabase
      .from('otp_attempts')
      .select('*', { count: 'exact', head: true })
      .eq('email', email.toLowerCase())
      .eq('attempt_type', 'send')
      .gte('created_at', oneHourAgo);

    if (countError) {
      console.error("Error checking rate limit:", countError);
    }

    if (count && count >= MAX_SEND_ATTEMPTS_PER_HOUR) {
      console.log(`Rate limit exceeded for ${email}: ${count} attempts in last hour`);
      return new Response(
        JSON.stringify({ error: 'Too many OTP requests. Please try again later.' }),
        { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Record this attempt
    await supabase.from('otp_attempts').insert({
      email: email.toLowerCase(),
      attempt_type: 'send'
    });

    console.log(`Sending OTP to ${email} for ${type}`);

    // Generate OTP code
    const code = generateOtp();

    // Delete any existing unused codes for this email
    await supabase
      .from('otp_codes')
      .delete()
      .eq('email', email.toLowerCase())
      .eq('used', false);

    // Insert new OTP code
    const { error: insertError } = await supabase
      .from('otp_codes')
      .insert({
        email: email.toLowerCase(),
        code,
        type,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      });

    if (insertError) {
      console.error("Error storing OTP:", insertError);
      throw new Error("Failed to generate verification code");
    }

    // Send email via Brevo API
    const brevoApiKey = Deno.env.get("BREVO_API_KEY");
    
    if (!brevoApiKey) {
      console.error("BREVO_API_KEY not configured");
      throw new Error("Email service not configured");
    }
    
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0f;">
        <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <div style="background: linear-gradient(135deg, rgba(20, 184, 166, 0.1), rgba(6, 182, 212, 0.1)); border: 1px solid rgba(20, 184, 166, 0.2); border-radius: 16px; padding: 40px; text-align: center;">
            <h1 style="color: #14b8a6; font-size: 32px; margin: 0 0 24px 0; font-weight: 700;">ThetAI</h1>
            <p style="color: #e5e5e5; font-size: 18px; margin: 0 0 32px 0; line-height: 1.6;">
              Hello, here is your 6-digit code!
            </p>
            <div style="background: rgba(20, 184, 166, 0.15); border: 2px solid rgba(20, 184, 166, 0.3); border-radius: 12px; padding: 24px; margin: 0 0 32px 0;">
              <span style="font-family: 'JetBrains Mono', 'Courier New', monospace; font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #14b8a6;">${code}</span>
            </div>
            <p style="color: #a3a3a3; font-size: 14px; margin: 0 0 32px 0;">
              This code will expire in 10 minutes.
            </p>
            <p style="color: #e5e5e5; font-size: 16px; margin: 0 0 8px 0;">
              Good luck!
            </p>
            <p style="color: #14b8a6; font-size: 14px; font-weight: 600; margin: 0;">
              By NeuraForge Labs
            </p>
          </div>
          <p style="color: #525252; font-size: 12px; text-align: center; margin: 24px 0 0 0;">
            If you didn't request this code, please ignore this email.
          </p>
        </div>
      </body>
      </html>
    `;

    const emailResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": brevoApiKey,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        sender: {
          name: "ThetAI",
          email: "noreplyneuraforge@gmail.com"
        },
        to: [{ email: email }],
        subject: "Your ThetAI Verification Code",
        htmlContent: emailHtml,
      }),
    });

    const responseText = await emailResponse.text();
    console.log("Brevo response status:", emailResponse.status);
    console.log("Brevo response:", responseText);
    
    let emailResult;
    try {
      emailResult = JSON.parse(responseText);
    } catch {
      console.error("Brevo returned non-JSON:", responseText);
      throw new Error("Email service error: " + responseText.substring(0, 200));
    }
    
    if (!emailResponse.ok) {
      console.error("Brevo error:", emailResult);
      throw new Error(emailResult.message || emailResult.error || "Failed to send email");
    }

    console.log("Email sent successfully via Brevo:", emailResult);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-otp function:", error);
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
