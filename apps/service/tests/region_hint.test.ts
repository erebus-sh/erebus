import { it, expect } from 'vitest';
import { getLocationHint } from '@/lib/location_hint';

/**
 * DurableObjectLocationHint short codes and their meanings:
 *   "wnam" - Western North America
 *   "enam" - Eastern North America
 *   "sam"  - South America
 *   "weur" - Western Europe
 *   "eeur" - Eastern Europe
 *   "apac" - Asia-Pacific (East Asia, Southeast Asia)
 *   "oc"   - Oceania (Australia, New Zealand)
 *   "afr"  - Africa
 *   "me"   - Middle East
 *
 * These codes are used by Cloudflare to indicate the closest region group for a request,
 * and are mapped to the nearest Upstash Redis region for data sharding and routing.
 */

it('Location hint to redis region', () => {
	// "NA" is the continent code for North America (see @location_hint.ts, ContinentCode type).
	// getLocationHint will choose the closest region group ("enam" = Eastern North America, "wnam" = Western North America)
	// based on the provided coordinates. At (0,0), "enam" is expected to be closer.
	const locationHint = getLocationHint({
		continentCode: 'SA',
		point: { lat: 0, lon: 0 },
	});

	// Log the selected region code and explain what "NA" means and what we expect.
	console.log(
		`continentCode: "NA" (North America), point: (0,0) → locationHint: "${locationHint}" (expected: "enam" for Eastern North America)`,
	);

	expect(locationHint).toBe('sam');
});
