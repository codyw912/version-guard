import { type VersionGuardConfig, mergeConfig } from "@version-guard/core";

interface OpenCodeConfig {
	"opencode-version-guard"?: Partial<VersionGuardConfig>;
}

export async function loadConfig(): Promise<VersionGuardConfig> {
	// Try to load from opencode.json in current directory
	try {
		const file = Bun.file("opencode.json");
		if (await file.exists()) {
			const content = (await file.json()) as OpenCodeConfig;
			if (content["opencode-version-guard"]) {
				return mergeConfig(content["opencode-version-guard"]);
			}
		}
	} catch {
		// Ignore errors, use defaults
	}

	return mergeConfig({});
}

const CHECKED_PATTERNS = [
	/^Dockerfile/i,
	/\.dockerfile$/i,
	/docker-compose.*\.ya?ml$/i,
	/compose.*\.ya?ml$/i,
	/^Cargo\.toml$/i,
];

export function shouldCheck(filePath: string, config: VersionGuardConfig): boolean {
	if (!config.enabled) return false;

	const filename = filePath.split("/").pop() ?? filePath;

	// Check ignore patterns
	for (const pattern of config.ignore) {
		const regex = new RegExp(pattern.replace(/\*/g, ".*"));
		if (regex.test(filePath)) return false;
	}

	// Check if file matches any known pattern
	return CHECKED_PATTERNS.some((pattern) => pattern.test(filename));
}
