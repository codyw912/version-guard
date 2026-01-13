import semver from "semver";
import type { Registry } from "../types";

const DOCKER_HUB_API = "https://registry.hub.docker.com/v2/repositories";

interface TagResult {
	name: string;
	tag_last_pushed: string;
}

interface TagsResponse {
	results: TagResult[];
	next: string | null;
}

function isValidSemverTag(tag: string): boolean {
	// Must start with digit or v followed by digit
	if (!/^v?\d/.test(tag)) return false;
	// Try to coerce to semver
	return semver.coerce(tag) !== null;
}

function extractVersion(tag: string): string | null {
	const coerced = semver.coerce(tag);
	return coerced ? coerced.version : null;
}

export const dockerHubRegistry: Registry = {
	name: "docker.io",

	supports(image: string): boolean {
		// Supports official images (library/*) and user images
		return !image.includes("ghcr.io") && !image.includes("gcr.io");
	},

	async getLatestVersion(image: string): Promise<string | null> {
		try {
			// Handle official images (nginx -> library/nginx)
			const imagePath = image.includes("/") ? image : `library/${image}`;
			const url = `${DOCKER_HUB_API}/${imagePath}/tags?page_size=100&ordering=last_updated`;

			const response = await fetch(url, {
				headers: {
					Accept: "application/json",
				},
			});

			if (!response.ok) {
				if (response.status === 429) {
					console.debug(`Rate limited fetching ${image}`);
				}
				return null;
			}

			const data = (await response.json()) as TagsResponse;

			// Filter to valid semver tags and find the highest version
			const versions = data.results
				.map((t) => t.name)
				.filter(isValidSemverTag)
				.map((tag) => ({ tag, version: extractVersion(tag) }))
				.filter((v): v is { tag: string; version: string } => v.version !== null)
				.sort((a, b) => semver.rcompare(a.version, b.version));

			// Return the highest non-prerelease version
			for (const v of versions) {
				const parsed = semver.parse(v.version);
				if (parsed && parsed.prerelease.length === 0) {
					return v.tag;
				}
			}

			// Fall back to highest version including prereleases
			return versions[0]?.tag ?? null;
		} catch (error) {
			console.debug(`Failed to fetch Docker Hub tags for ${image}:`, error);
			return null;
		}
	},
};
