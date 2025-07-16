// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handleWhatsAppUser } from './handleWhatsAppUser.ts';
import { CampaignManager } from "./campaignManager.ts";
import { TwilioManager } from "./twilioManager.ts";

Deno.serve(async (req)=>{

  // Parse Twilio Payload
  const { from, message, name } = await TwilioManager.parseTwilioMessage(req);
  if (!from) {
    return new Response("<Automated Message> We're experiencing technical issues, please try again later.", {
      status: 200
    });
  }

  // Register or Fetch User Data
  const { user, isNewUser, error } = await handleWhatsAppUser(from, name);
  if (error) {
    return new Response("<Automated Message> We're experiencing technical issues, please try again later.", {
      status: 200
    });
  }


  // Campaign Handler
  return await CampaignManager.handleUserCampaign(message, user, isNewUser);
});
