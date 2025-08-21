export type DistributedKeyEssentialParts = {
	projectId: string;
	resource: string;
	resourceType: string; // e.g. "channel" | "queue" | "whatever"
	version: string;
};

const SEPARATOR = ':';

export const DistributedKey = {
	/**
	 * Constructs a distributed key string from its parts.
	 * Example: "proj-123:logs:channel:v1"
	 */
	stringify(parts: DistributedKeyEssentialParts): string {
		return [parts.projectId, parts.resource, parts.resourceType, parts.version].join(SEPARATOR);
	},

	/**
	 * This appends the location hint to the key.
	 */
	appendLocationHint(distributedKey: string, locationHint: string): string {
		const parsed = this.parse(distributedKey);
		return [parsed.projectId, parsed.resource, parsed.resourceType, parsed.version, locationHint].join(SEPARATOR);
	},

	/**
	 * This removes the location hint from the key.
	 */
	removeLocationHint(distributedKey: string): string {
		const parsed = this.parse(distributedKey);
		return [parsed.projectId, parsed.resource, parsed.resourceType, parsed.version].join(SEPARATOR);
	},

	/**
	 * Parses a distributed key string into its typed parts.
	 * Throws an error if the format is invalid.
	 */
	parse(key: string): DistributedKeyEssentialParts {
		const parts = key.split(SEPARATOR);
		if (parts.length < 4 || parts.length > 5) {
			throw new Error(`Invalid DistributedKey: "${key}"`);
		}

		const [projectId, resource, resourceType, version] = parts;

		return {
			projectId,
			resource,
			resourceType,
			version,
		};
	},

	/**
	 * Checks whether a key follows the correct structure.
	 */
	isValid(key: string): boolean {
		const parts = key.split(SEPARATOR);
		return parts.length === 4 || parts.length === 5;
	},

	/**
	 * Extract the region from the key.
	 */
	getRegion(key: string): string {
		const parts = key.split(SEPARATOR);
		if (parts.length !== 5) throw new Error('Invalid key: no region found');
		return parts[4];
	},
};
