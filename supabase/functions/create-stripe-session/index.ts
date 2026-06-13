// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@13.11.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return json("ok", 200);
  }

  try {
    // ── 1. Vérifier auth ──
    // Récupérer l'en-tête Authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Header Authorization manquant." }, 401);

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) return json({ error: "Non authentifié." }, 401);

    // ── 2. Vérifier que c'est un patient ──
    const { data: userProfile } = await supabaseUser
      .from("utilisateurs")
      .select("role")
      .eq("id", user.id)
      .single();

    if (userProfile?.role !== "patient") {
      return json({ error: "Accès réservé aux patients." }, 403);
    }

    // ── 3. Récupérer patient_id ──
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: patientData, error: patientError } = await supabaseAdmin
      .from("patients")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (patientError || !patientData) {
      return json({ error: "Profil patient introuvable." }, 404);
    }

    // ── 4. Vérifier qu'il n'a pas déjà une demande payée ──
    const { data: existingRequest } = await supabaseAdmin
      .from("device_requests")
      .select("id, status, payment_status")
      .eq("patient_id", patientData.id)
      .in("status", ["pending", "approved"])
      .maybeSingle();

    if (existingRequest?.payment_status === "paid") {
      return json({ error: "Vous avez déjà une demande de bracelet en cours." }, 400);
    }

    // ── 5. Créer session Stripe ──
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
      apiVersion: "2023-10-16",
    });

    const siteUrl = Deno.env.get("SITE_URL") ?? "http://localhost:5173";

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: "Bracelet SmartGuardian",
              description: "Bracelet de télésurveillance médicale IoT",
              images: [],
            },
            unit_amount: 4900, // 49.00 EUR — modifiez selon votre prix
          },
          quantity: 1,
        },
      ],
      // ✅ Pour Flutter, on utilise un deep link
      success_url: `io.supabase.smartguardian://payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `io.supabase.smartguardian://payment-cancel`,
      metadata: {
        patient_id: patientData.id,
        user_id: user.id,
      },
    });

    // ── 6. Créer ou mettre à jour la device_request ──
    if (existingRequest) {
      // Mettre à jour la session Stripe existante
      await supabaseAdmin
        .from("device_requests")
        .update({
          stripe_session_id: session.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingRequest.id);
    } else {
      // Créer une nouvelle demande
      await supabaseAdmin
        .from("device_requests")
        .insert({
          patient_id: patientData.id,
          status: "pending",
          payment_status: "unpaid",
          stripe_session_id: session.id,
        });
    }

    console.log(`Session Stripe créée: ${session.id} pour patient: ${patientData.id}`);

    return json({
      success: true,
      url: session.url,           // ✅ URL Stripe Checkout
      session_id: session.id,
    }, 200);

  } catch (err) {
    console.error("create-stripe-session error:", err);
    return json({ error: "Erreur serveur interne." }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}