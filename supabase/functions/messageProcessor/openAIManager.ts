import { CampaignManager } from "./campaignManager.ts";
import { WhatsappUser } from "models/whatsappUser.ts";
import { WhatsappUserCampaign } from "models/whatsappUserCampaign.ts";
import { supabase } from "./supabaseClient.ts";
import OpenAI from "npm:openai@4.50.0";

export class OpenAIManager {
    private static OPENAI = new OpenAI({
        apiKey: Deno.env.get("OPENAI_API_KEY")
    });

    static async addMessageToThread(userCampaign: WhatsappUserCampaign, content: string, role: string = "user") {
        await CampaignManager.updateCampaignActivity(userCampaign);

        // Insert user message into thread
        await this.OPENAI.beta.threads.messages.create(userCampaign.thread_id, {
            role,
            content
        });
    }

    static async runThread(userCampaign: WhatsappUserCampaign, instructions: any = {}) {
        await CampaignManager.updateCampaignActivity(userCampaign);

        // 1. Retrieve assistant_id for this campaign
        const { data: campaign } = await supabase.from("campaigns").select("assistant_id").eq("id", userCampaign.campaign_id).single();
        const assistantId = campaign?.assistant_id;
        if (!assistantId) throw new Error("Missing assistant_id");

        // 2. Retrieve assistant profile for this campaign
        const { data: assistantProfile } = await supabase.from("campaign_assistant_profiles").select("*").eq("id", userCampaign.assistant_profile).single();
        if (!assistantProfile) throw new Error("Missing assistantProfile");

        // 3. Start assistant run
        const run = await this.OPENAI.beta.threads.runs.create(userCampaign.thread_id, {
            assistant_id: assistantId,
            additional_instructions: `User's available data is: ${JSON.stringify(instructions)} and Assistant's available data is: ${JSON.stringify(assistantProfile)}`
        });

        // 4. Poll until run completes
        let status = run.status;
        let runObj = run;
        while (![
            "completed",
            "failed",
            "canceled",
            "expired"
        ].includes(status)) {
            await new Promise((r) => setTimeout(r, 200));
            runObj = await this.OPENAI.beta.threads.runs.retrieve(userCampaign.thread_id, runObj.id);
            status = runObj.status;
        }

        console.log('OpenAIManager.runThread - USAGE', runObj.usage.prompt_tokens, runObj.usage.completion_tokens, runObj.usage.total_tokens);
        if (status !== "completed") {
            throw new Error(`Run ended in status: ${status}`);
        }

        // 5. Fetch assistant messages and pick the last reply
        const { data: msgs } = await this.OPENAI.beta.threads.messages.list(userCampaign.thread_id, {
            limit: 1
        });
        const assistantMsg = msgs.find((m) => m.role === "assistant");
        if (!assistantMsg) {
            throw new Error("Assistant produced no response");
        }

        const reply = assistantMsg.content[0].text.value;
        console.log('OpenAIManager.runThread - REPLY', reply);
        return reply;
    }

    static async checkForCompletion(reply: string | null) {
        if (reply && reply.includes('json') && reply.includes('{') && reply.includes('}')) {
            // This is a completion response
            console.log('OpenAIManager.checkForCompletion - COMPLETED', reply);


            const jsonSection = reply.substring(reply.indexOf('{'), reply.lastIndexOf('}') + 1);
            console.log('OpenAIManager.checkForCompletion - RAW', jsonSection);
            try {
                const data = JSON.parse(jsonSection);
                console.log('OpenAIManager.checkForCompletion - PARSED', data);
                
                return {
                    completion: true,
                    media: 'https://',
                    data
                }
            } catch (e) {
                console.log('OpenAIManager.checkForCompletion - ERROR', e.message);
                return {
                    completion: true,
                    media: null,
                    data: jsonSection
                }
            }
        } else {
            return {
                completion: false,
                media: null,
                data: null
            };
        }
    }
}