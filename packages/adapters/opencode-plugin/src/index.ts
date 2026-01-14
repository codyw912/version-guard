import { appendFileSync, readFileSync } from "node:fs";
import type { Plugin } from "@opencode-ai/plugin";
import { VersionCache, checkVersions, formatWarnings } from "@version-guard/core";
import { loadConfig, shouldCheck } from "./config";

// Debug log file
const DEBUG_LOG = "/tmp/version-guard-debug.log";

function debugLog(msg: string) {
	const timestamp = new Date().toISOString();
	appendFileSync(DEBUG_LOG, `[${timestamp}] ${msg}\n`);
}

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
				debugLog("input: " + JSON.stringify(input, null, 2));
				debugLog("output: " + JSON.stringify(output, null, 2));

				// Safely extract tool name
				const toolName = String(getNestedProp(input, "tool") ?? "").toLowerCase();

				debugLog(`toolName: ${toolName}`);

				// Only check write/edit operations
				if (toolName !== "edit" && toolName !== "write") {
					debugLog("skipping - not edit/write");
					return;
				}

				// Get filePath from output.metadata.filediff.file (for edit)
				// or output.metadata.file (for write)
				const filePath =
					getNestedProp(output, "metadata", "filediff", "file") ??
					getNestedProp(output, "metadata", "file");

				debugLog(`filePath: ${filePath}`);

				if (typeof filePath !== "string" || !filePath) {
					debugLog("skipping - no filePath");
					return;
				}

				const shouldCheckFile = shouldCheck(filePath, config);
				debugLog(`shouldCheck(${filePath}): ${shouldCheckFile}`);

				if (!shouldCheckFile) {
					debugLog("skipping - shouldCheck returned false");
					return;
				}

				// Get content from output.metadata.filediff.after (the new content after edit)
				// or read from file for write operations
				let content =
					getNestedProp(output, "metadata", "filediff", "after") ??
					getNestedProp(output, "metadata", "content");

				if (typeof content !== "string" || !content) {
					try {
						content = readFileSync(filePath, "utf-8");
						debugLog(`read file content, length: ${(content as string).length}`);
					} catch (err) {
						debugLog(`failed to read file: ${err}`);
						return;
					}
				} else {
					debugLog(`got content from metadata, length: ${(content as string).length}`);
				}

				debugLog("calling checkVersions...");
				const warnings = await checkVersions(filePath, content as string, config, cache!);
				debugLog(`warnings count: ${warnings.length}`);

				if (warnings.length > 0) {
					const formatted = formatWarnings(warnings);
					debugLog(`formatted warnings: ${formatted}`);
					// Append to tool output (same pattern as LSP diagnostics)
					output.output += `\n\n${formatted}`;
					debugLog("appended to output.output");
				}
			} catch (err) {
				debugLog(`ERROR: ${err}`);
			}
		},
	};
};

export default VersionGuard;
