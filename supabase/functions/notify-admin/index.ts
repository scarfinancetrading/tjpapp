import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userEmail, registrationDate } = await req.json();

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      // Gracefully skip email sending if API key is not configured
      console.warn("RESEND_API_KEY not configured - skipping email notification");

      // Still mark as notified so it doesn't retry
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      await supabase
        .from("profiles")
        .update({ admin_notified: true })
        .eq("email", userEmail);

      return new Response(
        JSON.stringify({ success: true, skipped: true, message: "Email notification skipped - RESEND_API_KEY not configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Trading Journal Pro App <onboarding@resend.dev>",
        to: ["investingforfuture09121110@gmail.com"],
        subject: "New User Pending Approval - Trading Journal Pro App",
        html: `
          <h2>New User Pending Approval</h2>
          <p>A new user has verified their email and is awaiting approval.</p>
          <ul>
            <li><strong>User Email:</strong> ${userEmail}</li>
            <li><strong>Registration Date:</strong> ${registrationDate}</li>
            <li><strong>Current Status:</strong> pending</li>
          </ul>
          <p>Please log in to the Admin Panel to approve or review this user.</p>
        `,
      }),
    });

    const data = await emailRes.json();

    // Mark as notified
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    await supabase
      .from("profiles")
      .update({ admin_notified: true })
      .eq("email", userEmail);

    return new Response(JSON.stringify({ success: true, data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
