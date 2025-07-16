import { createClient } from 'jsr:@supabase/supabase-js@2';
import { OpenAI } from "jsr:@openai/openai";
const openai = new OpenAI({
  apiKey: Deno.env.get("OPENAI_API_KEY")
});
Deno.serve(async (req)=>{
  // Set up response headers
  const headers = new Headers({
    'Content-Type': 'application/json'
  });
  try {
    // Parse the webhook payload
    const campaign = await req.json();
    console.log('Processing campaign record:', campaign);
    // Create Supabase client with service role key for admin operations
    const supabase = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
    // Fetch Campaign data
    const { data, error } = await supabase.from("campaigns").select("assistant_id").eq("id", campaign.campaign_id).single();
    if (error || !data || !data.assistant_id) {
      console.error("Campaign fetch error:", error);
      return new Response("Campaign not found", {
        status: 404
      });
    }
    const assistantId = data.assistant_id;
    const thread = await openai.beta.threads.create();
    console.log("✅ Created thread:", thread.id);
    // const run = await openai.beta.threads.runs.create(thread.id, {
    //   assistant_id: assistantId
    // });
    // console.log("🟢 Started run:", run.id);
    const threadId = thread.id;
    if (!threadId) {
      throw new Error('No thread_id returned from API');
    }
    console.log(`Received thread_id: ${threadId} for campaign: ${campaign.id}`);
    // Update the whatsapp_user_campaigns table with the thread_id
    const { error: updateError } = await supabase.from('whatsapp_user_campaigns').update({
      thread_id: threadId
    }).eq('id', campaign.id);
    if (updateError) {
      throw new Error(`Failed to update campaign with thread_id: ${updateError.message}`);
    }
    console.log(`Successfully updated campaign ${campaign.id} with thread_id ${threadId}`);
    return new Response(JSON.stringify({
      success: true,
      message: 'Thread created and campaign updated successfully',
      campaign_id: campaign.id,
      thread_id: threadId
    }), {
      status: 200,
      headers
    });
  } catch (error) {
    console.error('Error in createThread function:', error.message);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers
    });
  }
});
