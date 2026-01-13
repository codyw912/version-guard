import type { Parser, VersionPin } from "../types";

// Match: package = "version" or package = { version = "version", ... }
const INLINE_VERSION = /^(?<name>[\w-]+)\s*=\s*"(?<version>[=^~]?\d+(?:\.\d+){0,2}[^"]*)"/;
const TABLE_VERSION =
	/^(?<name>[\w-]+)\s*=\s*\{[^}]*version\s*=\s*"(?<version>[=^~]?\d+(?:\.\d+){0,2}[^"]*)"/;

// Detect sections we should skip
const SKIP_SECTIONS = new Set([
	"[package]",
	"[lib]",
	"[profile",
	"[features]",
	"[workspace]",
	"[patch",
	"[replace]",
]);

// Sections that contain dependencies
const DEP_SECTIONS = new Set(["[dependencies]", "[dev-dependencies]", "[build-dependencies]"]);

function shouldSkipVersion(version: string): boolean {
	// Skip wildcards
	if (version === "*") return true;
	// Skip workspace inheritance (handled at line level, but double-check)
	if (version.includes("workspace")) return true;
	return false;
}

export const cargoParser: Parser = {
	ecosystem: "cargo",
	filePatterns: [/^Cargo\.toml$/i],

	parse(content: string): VersionPin[] {
		const pins: VersionPin[] = [];
		const lines = content.split("\n");
		let inDepSection = false;
		let currentSection = "";

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i].trim();
			const lineNum = i + 1;

			// Check for section headers
			if (line.startsWith("[")) {
				currentSection = line.toLowerCase();

				// Check if this is a dependency section (including target-specific)
				inDepSection =
					[...DEP_SECTIONS].some((s) => currentSection.includes(s.slice(1, -1))) ||
					currentSection.includes("dependencies]");

				continue;
			}

			// Skip if not in a dependency section
			if (!inDepSection) continue;

			// Skip comments and empty lines
			if (line.startsWith("#") || line === "") continue;

			// Skip git/path/workspace dependencies
			if (line.includes("git =") || line.includes("path =") || line.includes("workspace = true")) {
				continue;
			}

			// Try to match version patterns
			const match = INLINE_VERSION.exec(line) || TABLE_VERSION.exec(line);

			if (!match?.groups) continue;

			const { name, version } = match.groups;

			if (shouldSkipVersion(version)) continue;

			pins.push({
				package: name,
				version: version.replace(/^[=^~]/, ""),
				line: lineNum,
				ecosystem: "cargo",
			});
		}

		return pins;
	},
};
