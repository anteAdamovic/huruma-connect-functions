import { CampaignAssistantProfile } from "models/campaignAssistantProfile.ts";
import { WhatsappUser } from "models/whatsappUser.ts";
import { WhatsappUserCampaign } from "models/whatsappUserCampaign.ts";
import { OnboardingManager } from "./onboardingManager.ts";
import { OpenAIManager } from "./openAIManager.ts";
import { supabase } from "./supabaseClient.ts";
import { TwilioManager } from "./twilioManager.ts";

export class CampaignManager {

    static async handleUserCampaign(message: string, user: WhatsappUser, isNewUser: boolean = false) {
        const onboardingCompleted = await OnboardingManager.handleUserOnboarding(message, user, isNewUser);
        if (!onboardingCompleted) {
            return new Response();
        }

        const activeCampaign = await this.getActiveCampaign(user);
        await OpenAIManager.addMessageToThread(activeCampaign, message);
        const reply = await OpenAIManager.runThread(activeCampaign, { phone: user.phone_number, ...user.raw['Onboarding'] });
        await TwilioManager.sendTwilioMessage(user.phone_number, reply);
    }

    static async getNewAssistantProfile(user: WhatsappUser) {
        const { data: userCampaigns } = await supabase.from('whatsapp_user_campaigns').select('*').eq('whatsapp_user_id', user.id);
        const { data: profiles } = await supabase.from('campaign_assistant_profiles').select('*');

        let newProfile: CampaignAssistantProfile;

        console.log("DEBUG - userCampaigns", userCampaigns);
        console.log("DEBUG - profiles", profiles);

        if (!userCampaigns || !userCampaigns.length) {
            // No campaigns yet - take any random profile
            const randomId = Math.floor(Math.random() * profiles.length);
            newProfile = profiles[randomId];
            console.log("CampaignManager.getNewAssistantProfile", newProfile);

            return {
                assistant: newProfile,
                same: false
            }
        } else {
            const lastActiveProfile = userCampaigns.reverse()[0].assistant_profile;
            newProfile = profiles.find(p => p.id === lastActiveProfile) as CampaignAssistantProfile;
            console.log("CampaignManager.getNewAssistantProfile", newProfile);
            return {
                assistant: newProfile,
                same: true
            }
        }
    }

    static async updateCampaignActivity(userCampaign: WhatsappUserCampaign) {
        await supabase.from("whatsapp_user_campaigns").update({
            last_activity_at: new Date().toISOString()
        }).eq("id", userCampaign.id);
    }

    static async markCampaignCompleted(userCampaign: WhatsappUserCampaign, user: WhatsappUser, data: any = {}) {
        await supabase.from("whatsapp_user_campaigns").update({
            completed_at: new Date().toISOString()
        }).eq("id", userCampaign.id);

        // 1. Retrieve name for this campaign
        const { data: campaign } = await supabase.from("campaigns").select("name").eq("id", userCampaign.campaign_id).single();
        const campaignName = campaign?.name;
        if (!campaignName) throw new Error("Missing campaign name");

        // 2. Retrieve user raw data
        const { data: userData } = await supabase.from("whatsapp_users").select("raw").eq("id", user.id).single();
        const raw = userData?.raw;
        if (!raw) throw new Error("Missing raw user data");

        // 3. Update user raw data
        raw[campaignName] = data;
        await supabase.from("whatsapp_users").update({
            raw
        }).eq("id", user.id);
    }

    static async enableCampaign(user: WhatsappUser, campaignId: number, userInitiated: boolean = false) {
        const assistantProfile = await this.getNewAssistantProfile(user);
        await supabase.from("whatsapp_user_campaigns").insert({
            whatsapp_user_id: user.id,
            campaign_id: campaignId,
            user_initiated: userInitiated,
            assistant_profile: assistantProfile.assistant.id
        }).select().single();
    }

    static async getActiveCampaign(user: WhatsappUser) {
        const { data: userCampaign } = await supabase
            .from("whatsapp_user_campaigns")
            .select("*")
            .eq("whatsapp_user_id", user.id)
            .is("completed_at", null)
            .order("created_at", { ascending: false })
            .single();
        if (!userCampaign) throw new Error("CampaignManager.getActiveCampaign - NONE");

        return userCampaign;
    }
}