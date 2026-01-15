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

// Output structure from tool.execute.after hook
interface ToolOutput {
	title: string;
	output: string;
	metadata: unknown;
}

export const VersionGuard: Plugin = async (_ctx) => {
	const config = await loadConfig();
	cache = new VersionCache(config.cache.ttlMinutes);

	return {
		"tool.execute.after": async (input: unknown, output: ToolOutput) => {
			// Only check edit/write operations
			const toolName = String(getNestedProp(input, "tool") ?? "").toLowerCase();
			if (toolName !== "edit" && toolName !== "write") return;

			// Get filePath from output.metadata.filediff.file (for edit)
			// or output.metadata.file (for write)
			const filePath =
				getNestedProp(output, "metadata", "filediff", "file") ??
				getNestedProp(output, "metadata", "file");

			if (typeof filePath !== "string" || !filePath) return;
			if (!shouldCheck(filePath, config)) return;

			// Get content from output.metadata.filediff.after (the new content after edit)
			// or read from file for write operations
			let content =
				getNestedProp(output, "metadata", "filediff", "after") ??
				getNestedProp(output, "metadata", "content");

			if (typeof content !== "string" || !content) {
				try {
					content = readFileSync(filePath, "utf-8");
				} catch {
					return; // File doesn't exist or can't be read
				}
			}

			const warnings = await checkVersions(filePath, content as string, config, cache!);

			if (warnings.length > 0) {
				// Append to tool output (same pattern as LSP diagnostics)
				output.output += `\n\n${formatWarnings(warnings)}`;
			}
		},
	};
};

export default VersionGuard;
