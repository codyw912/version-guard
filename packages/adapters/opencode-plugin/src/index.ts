import { readFileSync } from "node:fs";
import type { Plugin } from "@opencode-ai/plugin";
import { VersionCache, checkVersions, formatWarnings } from "@version-guard/core";
import { loadConfig, shouldCheck } from "./config";

// Singleton cache shared across all hook invocations
let cache: VersionCache | null = null;

// Helper to safely extract nested properties
function getNestedProp(obj: unknown, ...keys: string[]): unknown {
	let current = obj;
	for (const key of keys) {
		if (current == null || typeof current !== "object") return undefined;
		current = (current as Record<string, unknown>)[key];
	}
	return current;
}

export const VersionGuard: Plugin = async ({ client }) => {
	const config = await loadConfig();
	cache = new VersionCache(config.cache.ttlMinutes);

	// Note: Don't call client.app.log() during plugin init - only in hooks

	return {
		"tool.execute.after": async (input, _output) => {
			// Safely extract tool name - could be input.tool or input.name
			const toolName = String(
				getNestedProp(input, "tool") ?? getNestedProp(input, "name") ?? "",
			).toLowerCase();

			// Only check write/edit operations
			if (toolName !== "edit" && toolName !== "write") return;

			// Try multiple paths for filePath
			const filePath =
				getNestedProp(input, "args", "filePath") ??
				getNestedProp(input, "args", "file_path") ??
				getNestedProp(input, "args", "path") ??
				getNestedProp(input, "filePath") ??
				getNestedProp(input, "file_path") ??
				getNestedProp(input, "path");

			if (typeof filePath !== "string" || !filePath) return;
			if (!shouldCheck(filePath, config)) return;

			// Try to get content from input, otherwise read the file
			let content = getNestedProp(input, "args", "content") ?? getNestedProp(input, "content");

			if (typeof content !== "string" || !content) {
				try {
					content = readFileSync(filePath, "utf-8");
				} catch {
					return; // File doesn't exist or can't be read
				}
			}

			const warnings = await checkVersions(filePath, content as string, config, cache!);

			if (warnings.length > 0) {
				await client.app.log({
					service: "version-guard",
					level: "warn",
					message: formatWarnings(warnings),
				});
			}
		},
	};
};

export default VersionGuard;
