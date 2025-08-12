import { CampaignManager } from "./campaignManager.ts";
import { WhatsappUser } from "models/whatsappUser.ts";
import { OpenAIManager } from "./openAIManager.ts";
import { supabase } from "./supabaseClient.ts";
import { TwilioManager } from "./twilioManager.ts";

export class OnboardingManager {
    static ONBOARDING_CAMPAIGN_ID = 3;
    static GENERAL_MEDICAL_CAMPAIGN_ID = 2;

    static async handleUserOnboarding(message: string, user: WhatsappUser, isNewUser: boolean = false): Promise<boolean> {
        // Onboarding Campaign Logic
        const { status, message: statusMessage, userCampaign, assistantProfile } = await this.checkOnboardingCampaignStatus(user, isNewUser);
        console.log('OnboardingManager.handleOnboarding', statusMessage);

        if (status === 'completed') {
            return true;
        } else if (status === 'error') {
            const reply = "<Automated Message> We're experiencing technical issues, please try again later.";
            await TwilioManager.sendTwilioMessage(user.phone_number, reply);
            return false;
        } else {
            // Run OpenAI and send reply
            await OpenAIManager.addMessageToThread(userCampaign, message);
            const reply = await OpenAIManager.runThread(userCampaign, { phone_number: user.phone_number });

            const { completion, media, data } = await OpenAIManager.checkForCompletion(reply);
            if (completion) {
                await CampaignManager.markCampaignCompleted(userCampaign, user, data);
                await TwilioManager.sendTwilioMessage(user.phone_number, '', 'HXbad1019d15f79d40f2e4a6c11312d8ea');

                // Enable general medical assistant campaign
                await CampaignManager.enableCampaign(user, OnboardingManager.GENERAL_MEDICAL_CAMPAIGN_ID);
                return true;
            } else {
                await TwilioManager.sendTwilioMessage(user.phone_number, reply);
                return false;
            }
        }
    }

    static async checkOnboardingCampaignStatus(user: WhatsappUser, isNewUser: boolean = false) {
        const whatsappUserId = user?.id;
        try {
            // Validate input
            if (!whatsappUserId || typeof whatsappUserId !== 'number') {
                return {
                    status: 'error',
                    message: 'Invalid WhatsApp user ID provided',
                    userCampaign: null,
                    assistantProfile: null
                };
            }
            // Check if is new user
            if (isNewUser) {
                return await this.createNewOnboarding(user);
            }

            // Check if the user has an onboarding campaign
            const { data: existingCampaign, error: campaignError } = await supabase.from('whatsapp_user_campaigns').select('*').eq('whatsapp_user_id', whatsappUserId).eq('campaign_id', this.ONBOARDING_CAMPAIGN_ID).single();
            // Handle database error
            if (campaignError && campaignError.code !== 'PGRST116') {
                console.error('Error checking onboarding campaign:', campaignError);
                return {
                    status: 'error',
                    message: `Database error: ${campaignError.message}`,
                    userCampaign: null,
                    assistantProfile: null
                };
            }
            // Case 1: User has completed onboarding
            if (existingCampaign && existingCampaign.completed_at) {
                return {
                    status: 'completed',
                    message: 'User has already completed onboarding',
                    userCampaign: existingCampaign,
                    assistantProfile: null
                };
            }
            // Case 2: User has started but not completed onboarding
            if (existingCampaign) {
                return {
                    status: 'in_progress',
                    message: 'User has started but not completed onboarding',
                    userCampaign: existingCampaign,
                    assistantProfile: null
                };
            }
            // Case 3: User has not started onboarding - create a new campaign entry
            return await this.createNewOnboarding(user);
        } catch (error) {
            console.error('Unexpected error in handleOnboarding:', error);
            return {
                status: 'error',
                message: `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
                userCampaign: null,
                assistantProfile: null
            };
        }
    }

    static async createNewOnboarding(user: WhatsappUser) {
        console.log("OnboardingManager.createNewOnboarding", user);
        const timestamp = new Date().toISOString();
        const assistantProfile = await CampaignManager.getNewAssistantProfile(user);

        const { data: newCampaign, error: insertError } = await supabase.from('whatsapp_user_campaigns').insert({
            whatsapp_user_id: user.id,
            campaign_id: this.ONBOARDING_CAMPAIGN_ID,
            created_at: timestamp,
            completed_at: null,
            user_initiated: true,
            last_activity_at: timestamp,
            assistant_profile: assistantProfile.assistant.id
        }).select().single();
        if (insertError) {
            console.error('Error creating onboarding campaign:', insertError);
            return {
                status: 'error',
                message: `Failed to create onboarding campaign: ${insertError.message}`,
                userCampaign: null,
                assistantProfile: null
            };
        }
        return {
            status: 'created',
            message: 'Onboarding campaign created successfully',
            userCampaign: newCampaign,
            assistantProfile
        };
    }
}