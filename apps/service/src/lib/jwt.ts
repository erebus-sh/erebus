import { SignJWT, jwtVerify, importJWK, type JWTPayload } from 'jose';

const alg = 'EdDSA'; // Ed25519 under the hood

const getPriv = (private_key: string) => importJWK(JSON.parse(private_key), alg);
const getPub = (public_key: string) => importJWK(JSON.parse(public_key), alg);

export async function sign(payload: JWTPayload, private_key: string) {
	return new SignJWT(payload)
		.setProtectedHeader({ alg })
		.setIssuedAt()
		.setExpirationTime('2h')
		.sign(await getPriv(private_key));
}

export async function verify(token: string, public_key: string) {
	try {
		const payload = await jwtVerify(token, await getPub(public_key));
		return payload; // throws if signature or exp fails
	} catch (err) {
		console.error('verify error:', err);
		return null;
	}
}
