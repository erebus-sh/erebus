import { GrantSchema, Grant } from '@/schemas/grant';
import { verify } from './jwt';

/**
 * Verifies two separate tokens:
 * - `grantToken`: who the client is and what they're allowed to do
 * - `routeToken`: where the request should be routed (project/resource)
 *
 * Both must be signed with the same secret (or split secrets if you want later).
 *
 * Returns a merged object of the grant and channel data, plus the project ID as `proj_id`.
 */
export async function verifyRequestToken(grantToken: string, public_key: string): Promise<Grant | null> {
	try {
		const grantResult = await verify(grantToken, public_key);
		if (!grantResult) {
			const msg = 'Grant token validation failed: signature or structure invalid';
			console.error(msg);
			throw new Error(msg);
		}
		const grantPayload = grantResult.payload;
		const parsedGrant = GrantSchema.safeParse(grantPayload);
		if (!parsedGrant.success) {
			const msg = `Grant token validation failed: schema error: ${parsedGrant.error.toString()}`;
			console.error(msg);
			throw new Error(msg);
		}
		return parsedGrant.data;
	} catch (err) {
		console.error('verifyRequestToken error:', err);
		return null;
	}
}
