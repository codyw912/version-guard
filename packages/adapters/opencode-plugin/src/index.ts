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
			try {
				// DEBUG: Log both input and output structures
				console.error("[version-guard] input:", JSON.stringify(input, null, 2).slice(0, 800));
				console.error("[version-guard] output:", JSON.stringify(output, null, 2).slice(0, 800));

				// Safely extract tool name - could be input.tool or input.name
				const toolName = String(
					getNestedProp(input, "tool") ?? getNestedProp(input, "name") ?? "",
				).toLowerCase();

				console.error(`[version-guard] toolName: ${toolName}`);

				// Only check write/edit operations
				if (toolName !== "edit" && toolName !== "write") {
					console.error("[version-guard] skipping - not edit/write");
					return;
				}

				// Try multiple paths for filePath - check BOTH input and output
				const filePath =
					// Check input
					getNestedProp(input, "args", "filePath") ??
					getNestedProp(input, "filePath") ??
					// Check output.metadata (where args might be stored after execution)
					getNestedProp(output, "metadata", "filePath") ??
					getNestedProp(output, "metadata", "args", "filePath") ??
					// Check output directly
					getNestedProp(output, "filePath") ??
					getNestedProp(output, "args", "filePath");

				console.error(`[version-guard] filePath: ${filePath}`);

				if (typeof filePath !== "string" || !filePath) {
					console.error("[version-guard] skipping - no filePath");
					return;
				}

				const shouldCheckFile = shouldCheck(filePath, config);
				console.error(`[version-guard] shouldCheck(${filePath}): ${shouldCheckFile}`);

				if (!shouldCheckFile) {
					console.error("[version-guard] skipping - shouldCheck returned false");
					return;
				}

				// Try to get content from input, otherwise read the file
				let content = getNestedProp(input, "args", "content") ?? getNestedProp(input, "content");

				if (typeof content !== "string" || !content) {
					try {
						content = readFileSync(filePath, "utf-8");
						console.error(
							`[version-guard] read file content, length: ${(content as string).length}`,
						);
					} catch (err) {
						console.error(`[version-guard] failed to read file: ${err}`);
						return;
					}
				} else {
					console.error(
						`[version-guard] got content from input, length: ${(content as string).length}`,
					);
				}

				console.error("[version-guard] calling checkVersions...");
				const warnings = await checkVersions(filePath, content as string, config, cache!);
				console.error(`[version-guard] warnings count: ${warnings.length}`);

				if (warnings.length > 0) {
					const formatted = formatWarnings(warnings);
					console.error(`[version-guard] formatted warnings: ${formatted}`);
					// Append to tool output (same pattern as LSP diagnostics)
					output.output += `\n\n${formatted}`;
					console.error("[version-guard] appended to output.output");
				}
			} catch (err) {
				console.error(`[version-guard] ERROR: ${err}`);
			}
		},
	};
};

export default VersionGuard;
