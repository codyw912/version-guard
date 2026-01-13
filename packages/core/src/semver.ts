import semver from "semver";
import type { UpdateType } from "./types";

export function parseVersion(version: string): string | null {
	const cleaned = version.replace(/^[=^~]/, "");
	const coerced = semver.coerce(cleaned);
	return coerced ? coerced.version : null;
}

export function compareVersions(current: string, latest: string): number {
	const currentParsed = parseVersion(current);
	const latestParsed = parseVersion(latest);

	if (!currentParsed || !latestParsed) return 0;

	return semver.compare(currentParsed, latestParsed);
}

export function getUpdateType(current: string, latest: string): UpdateType | null {
	const currentParsed = parseVersion(current);
	const latestParsed = parseVersion(latest);

	if (!currentParsed || !latestParsed) return null;

	const diff = semver.diff(currentParsed, latestParsed);

	if (!diff) return null;

	if (diff.includes("major")) return "major";
	if (diff.includes("minor")) return "minor";
	if (diff.includes("patch")) return "patch";

	// Handle prerelease -> release (e.g., 1.0.0-alpha -> 1.0.0)
	if (diff === "prerelease" || diff === "prepatch" || diff === "preminor" || diff === "premajor") {
		return "patch";
	}

	return null;
}

export function isNewerVersion(current: string, latest: string): boolean {
	return compareVersions(current, latest) < 0;
}

export function isPrerelease(version: string): boolean {
	const parsed = semver.parse(version);
	return parsed ? parsed.prerelease.length > 0 : false;
}
