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

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, type }: SendOtpRequest = await req.json();
    
    console.log(`Sending OTP to ${email} for ${type}`);

    // Generate OTP code
    const code = generateOtp();

    // Store OTP in database
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Delete any existing unused codes for this email
    await supabase
      .from('otp_codes')
      .delete()
      .eq('email', email)
      .eq('used', false);

    // Insert new OTP code
    const { error: insertError } = await supabase
      .from('otp_codes')
      .insert({
        email,
        code,
        type,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      });

    if (insertError) {
      console.error("Error storing OTP:", insertError);
      throw new Error("Failed to generate verification code");
    }

    // Send email via Resend API directly
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    
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

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "ThetAI <onboarding@resend.dev>",
        to: [email],
        subject: "Your ThetAI Verification Code",
        html: emailHtml,
      }),
    });

    const emailResult = await emailResponse.json();
    
    if (!emailResponse.ok) {
      console.error("Resend error:", emailResult);
      throw new Error(emailResult.message || "Failed to send email");
    }

    console.log("Email sent successfully:", emailResult);

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
