import ky from 'ky';
import 

// TODO: Implement usage tracking webhooks here
export class UsageWebhook {
	constructor(private readonly env: Env) {}

	async sendUsage(usage: Usage) {
		const response = await ky.post(this.env.EREBUS_USAGE_WEBHOOK_URL, {
			json: usage,
		});
	}
}   