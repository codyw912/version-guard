#!/usr/bin/env bun
import {
	VersionCache,
	type VersionGuardConfig,
	checkVersions,
	formatWarnings,
	mergeConfig,
} from "@version-guard/core";

interface ToolPayload {
	tool: string;
	args: {
		filePath?: string;
		file_path?: string;
		path?: string;
		content?: string;
	};
	result?: string;
}

function parseArgs(): { stdin: boolean; file?: string; help: boolean } {
	const args = process.argv.slice(2);
	return {
		stdin: args.includes("--stdin") || args.includes("-"),
		file: args.find((a) => !a.startsWith("-")),
		help: args.includes("--help") || args.includes("-h"),
	};
}

function printHelp(): void {
	console.log(`
version-guard - Check for outdated package versions

Usage:
  version-guard --stdin          Read tool payload from stdin (for hooks)
  version-guard <file>           Check a specific file
  version-guard --help           Show this help message

Examples:
  # Check a Dockerfile
  version-guard Dockerfile

  # Check a Cargo.toml
  version-guard Cargo.toml

  # Use with hooks (reads JSON payload from stdin)
  echo '{"tool":"write","args":{"filePath":"Dockerfile","content":"FROM nginx:1.25.3"}}' | version-guard --stdin
`);
}

async function readStdin(): Promise<string> {
	const chunks: Buffer[] = [];
	for await (const chunk of process.stdin) {
		chunks.push(chunk);
	}
	return Buffer.concat(chunks).toString("utf-8");
}

async function checkFromStdin(config: VersionGuardConfig, cache: VersionCache): Promise<void> {
	const input = await readStdin();

	let payload: ToolPayload;
	try {
		payload = JSON.parse(input);
	} catch {
		console.error("Failed to parse stdin as JSON");
		process.exit(1);
	}

	// Only check write/edit operations
	if (payload.tool !== "write" && payload.tool !== "edit") {
		return;
	}

	const filePath = payload.args.filePath ?? payload.args.file_path ?? payload.args.path;
	const content = payload.args.content ?? payload.result;

	if (!filePath || !content) {
		return;
	}

	const warnings = await checkVersions(filePath, content, config, cache);

	if (warnings.length > 0) {
		console.log(formatWarnings(warnings));
	}
}

async function checkFile(
	filePath: string,
	config: VersionGuardConfig,
	cache: VersionCache,
): Promise<void> {
	const file = Bun.file(filePath);

	if (!(await file.exists())) {
		console.error(`File not found: ${filePath}`);
		process.exit(1);
	}

	const content = await file.text();
	const warnings = await checkVersions(filePath, content, config, cache);

	if (warnings.length > 0) {
		console.log(formatWarnings(warnings));
		process.exit(1);
	} else {
		console.log("All versions are up to date.");
	}
}

async function main(): Promise<void> {
	const args = parseArgs();

	if (args.help) {
		printHelp();
		return;
	}

	// TODO: Load config from opencode.json or version-guard.json
	const config = mergeConfig({});
	const cache = new VersionCache(config.cache.ttlMinutes);

	if (args.stdin) {
		await checkFromStdin(config, cache);
	} else if (args.file) {
		await checkFile(args.file, config, cache);
	} else {
		printHelp();
		process.exit(1);
	}
}

main().catch((error) => {
	console.error("Error:", error.message);
	process.exit(1);
});
