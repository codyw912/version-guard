import { readFileSync } from "node:fs";
import { VersionCache, checkVersions, formatWarnings } from "@version-guard/core";
import { loadConfig, shouldCheck } from "./config";

// OpenCode plugin context
interface PluginContext {
	project: unknown;
	client: unknown;
	$: unknown;
	directory: string;
	worktree: string;
}

// Tool execution input from tool.execute.after hook
interface ToolExecutionInput {
	tool: string;
	args: {
		filePath?: string;
		file_path?: string;
		path?: string;
		content?: string;
	};
	sessionID?: string;
}

type PluginHooks = {
	"tool.execute.after"?: (input: ToolExecutionInput) => Promise<void>;
};

type Plugin = (context: PluginContext) => Promise<PluginHooks>;

// Singleton cache shared across all hook invocations
let cache: VersionCache | null = null;

export const VersionGuard: Plugin = async (_ctx) => {
	const config = await loadConfig();
	cache = new VersionCache(config.cache.ttlMinutes);

	return {
		"tool.execute.after": async (input) => {
			// Only check write/edit operations
			if (input.tool !== "edit" && input.tool !== "write") return;

			const filePath = input.args.filePath ?? input.args.file_path ?? input.args.path;
			if (!filePath) return;
			if (!shouldCheck(filePath, config)) return;

			// For write: content is in args.content
			// For edit: read the file after the edit completed
			let content = input.args.content;
			if (!content) {
				try {
					content = readFileSync(filePath, "utf-8");
				} catch {
					return; // File doesn't exist or can't be read
				}
			}

			const warnings = await checkVersions(filePath, content, config, cache!);

			if (warnings.length > 0) {
				// Log warning to OpenCode's output
				console.log(formatWarnings(warnings));
			}
		},
	};
};

export default VersionGuard;
