import type { VersionGuardConfig } from "./types";

export const DEFAULT_CONFIG: VersionGuardConfig = {
	enabled: true,

	docker: {
		enabled: true,
		registries: ["docker.io"],
		ignoreTags: ["latest", "dev", "nightly", "edge", "canary", "alpha", "beta", "rc"],
		ignoreImages: [],
	},

	cargo: {
		enabled: true,
		ignorePrerelease: true,
		ignoreCrates: [],
	},

	severity: {
		major: "warn",
		minor: "warn",
		patch: "info",
	},

	cache: {
		ttlMinutes: 10,
	},

	ignore: ["vendor/*", "node_modules/*", "target/*", ".git/*"],

	batchSize: 10,
	batchDelayMs: 500,
};

export function mergeConfig(partial: Partial<VersionGuardConfig>): VersionGuardConfig {
	return {
		...DEFAULT_CONFIG,
		...partial,
		docker: { ...DEFAULT_CONFIG.docker, ...partial.docker },
		cargo: { ...DEFAULT_CONFIG.cargo, ...partial.cargo },
		severity: { ...DEFAULT_CONFIG.severity, ...partial.severity },
		cache: { ...DEFAULT_CONFIG.cache, ...partial.cache },
	};
}
