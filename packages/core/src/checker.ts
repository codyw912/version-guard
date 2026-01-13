import { VersionCache } from "./cache";
import { DEFAULT_CONFIG } from "./config";
import { getParserForFile } from "./parsers";
import { getRegistryForEcosystem } from "./registries";
import { getUpdateType, isNewerVersion } from "./semver";
import type { VersionGuardConfig, VersionPin, VersionWarning } from "./types";

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function getCacheKey(pin: VersionPin): string {
	if (pin.ecosystem === "docker") {
		return `docker:${pin.registry}/${pin.package}`;
	}
	return `${pin.ecosystem}:${pin.package}`;
}

async function checkPin(
	pin: VersionPin,
	file: string,
	cache: VersionCache,
): Promise<VersionWarning | null> {
	const cacheKey = getCacheKey(pin);
	let latest = cache.get(cacheKey);

	if (!latest) {
		const registry = getRegistryForEcosystem(pin.ecosystem);
		if (!registry) return null;

		latest = await registry.getLatestVersion(pin.package);
		if (!latest) return null;

		cache.set(cacheKey, latest);
	}

	if (!isNewerVersion(pin.version, latest)) {
		return null;
	}

	const updateType = getUpdateType(pin.version, latest);
	if (!updateType) return null;

	return {
		file,
		line: pin.line,
		ecosystem: pin.ecosystem,
		package: pin.package,
		current: pin.version,
		latest,
		updateType,
	};
}

export async function checkVersions(
	filePath: string,
	content: string,
	config: VersionGuardConfig = DEFAULT_CONFIG,
	cache: VersionCache = new VersionCache(config.cache.ttlMinutes),
): Promise<VersionWarning[]> {
	const filename = filePath.split("/").pop() ?? filePath;
	const parser = getParserForFile(filename);

	if (!parser) return [];

	// Check if ecosystem is enabled
	if (parser.ecosystem === "docker" && !config.docker.enabled) return [];
	if (parser.ecosystem === "cargo" && !config.cargo.enabled) return [];

	const pins = parser.parse(content);
	const warnings: VersionWarning[] = [];

	// Filter ignored packages
	const filteredPins = pins.filter((pin) => {
		if (pin.ecosystem === "docker") {
			if (config.docker.ignoreImages.includes(pin.package)) return false;
			if (config.docker.ignoreTags.some((t) => pin.version.includes(t))) return false;
		}
		if (pin.ecosystem === "cargo") {
			if (config.cargo.ignoreCrates.includes(pin.package)) return false;
		}
		return true;
	});

	// Process in batches
	for (let i = 0; i < filteredPins.length; i += config.batchSize) {
		const batch = filteredPins.slice(i, i + config.batchSize);

		const results = await Promise.all(batch.map((pin) => checkPin(pin, filePath, cache)));

		for (const result of results) {
			if (result) {
				warnings.push(result);
			}
		}

		// Pause between batches (unless last batch)
		if (i + config.batchSize < filteredPins.length) {
			await sleep(config.batchDelayMs);
		}
	}

	return warnings;
}

export function formatWarnings(warnings: VersionWarning[]): string {
	if (warnings.length === 0) return "";

	const lines: string[] = [
		"+------------------------------------------------------------------+",
		`| Version Guard: ${warnings.length} outdated package${warnings.length === 1 ? "" : "s"} found`,
		"+------------------------------------------------------------------+",
		"",
	];

	// Group by file
	const byFile = new Map<string, VersionWarning[]>();
	for (const w of warnings) {
		const existing = byFile.get(w.file) ?? [];
		existing.push(w);
		byFile.set(w.file, existing);
	}

	for (const [file, fileWarnings] of byFile) {
		lines.push(`  ${file}`);
		for (const w of fileWarnings) {
			lines.push(`    :${w.line}  ${w.package} = "${w.current}" -> ${w.latest} (${w.updateType})`);
		}
		lines.push("");
	}

	lines.push("+------------------------------------------------------------------+");

	return lines.join("\n");
}
