export class TwilioManager {
    private static FLOW_SID = Deno.env.get("TWILIO_FLOW_SID");
    private static ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    private static AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
    private static FROM = Deno.env.get("TWILIO_FROM_NUMBER");

    static async sendTwilioMessage(to: string, message: string, template: string | null = null) {
        to = "whatsapp:" + to;
        const url = `https://studio.twilio.com/v2/Flows/${this.FLOW_SID}/Executions`;
        const auth = btoa(`${this.ACCOUNT_SID}:${this.AUTH_TOKEN}`);
        const body = new URLSearchParams();
        body.append("To", to);
        body.append("From", this.FROM);
        body.append("Parameters", JSON.stringify({
            "Message": message,
            "MessageType": template ? "template" : "message",
            "Template": template
        }));
        const res = await fetch(url, {
            method: "POST",
            headers: {
                "Authorization": `Basic ${auth}`,
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: body.toString()
        });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Twilio API error (${res.status}): ${text}`);
        }
        return await res.json();
    }

    static async parseTwilioMessage(request: Request) {
        const contentType = request.headers.get("content-type") || "";
        if (contentType.includes("application/x-www-form-urlencoded")) {
            const form = await request.formData();
            const body = Object.fromEntries(form.entries());
            console.log("TwilioManager.parseTwilioMessage", body);
            const from = body["From"].toString().replace("whatsapp:", "").trim();
            const message = body["Body"];
            const name = body["ProfileName"];
            return {
                from,
                message,
                name
            };
        } else if (contentType.includes("application/json")) {
            const { from, name, message } = await request.json();
            console.log("TwilioManager.parseTwilioMessage", from, name, message);
            return {
                from: from.toString().replace("whatsapp:", "").trim(),
                name,
                message
            };
        } else {
            console.log("TwilioManager.parseTwilioMessage", null);
            return {
                from: null,
                name: null,
                message: null
            }
        }
    }
}