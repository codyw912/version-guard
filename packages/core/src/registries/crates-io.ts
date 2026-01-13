import semver from "semver";
import type { Registry } from "../types";

const CRATES_INDEX_URL = "https://index.crates.io";

interface CrateVersion {
	vers: string;
	yanked: boolean;
}

function getIndexPath(crateName: string): string {
	const name = crateName.toLowerCase();
	const len = name.length;

	if (len === 1) {
		return `1/${name}`;
	}
	if (len === 2) {
		return `2/${name}`;
	}
	if (len === 3) {
		return `3/${name[0]}/${name}`;
	}
	return `${name.slice(0, 2)}/${name.slice(2, 4)}/${name}`;
}

export const cratesIoRegistry: Registry = {
	name: "crates.io",

	supports(_pkg: string): boolean {
		return true;
	},

	async getLatestVersion(crateName: string): Promise<string | null> {
		try {
			const indexPath = getIndexPath(crateName);
			const url = `${CRATES_INDEX_URL}/${indexPath}`;

			const response = await fetch(url, {
				headers: {
					Accept: "application/json",
					"User-Agent": "opencode-version-guard (https://github.com/user/opencode-version-guard)",
				},
			});

			if (!response.ok) {
				if (response.status === 404) {
					console.debug(`Crate not found: ${crateName}`);
				}
				return null;
			}

			const text = await response.text();

			// Parse newline-delimited JSON
			const versions: CrateVersion[] = text
				.trim()
				.split("\n")
				.map((line) => JSON.parse(line) as CrateVersion)
				.filter((v) => !v.yanked);

			// Sort by semver and find highest stable version
			const sorted = versions
				.map((v) => v.vers)
				.filter((vers) => semver.valid(vers))
				.sort((a, b) => semver.rcompare(a, b));

			// Prefer stable versions over prereleases
			for (const vers of sorted) {
				const parsed = semver.parse(vers);
				if (parsed && parsed.prerelease.length === 0) {
					return vers;
				}
			}

			// Fall back to highest version including prereleases
			return sorted[0] ?? null;
		} catch (error) {
			console.debug(`Failed to fetch crate info for ${crateName}:`, error);
			return null;
		}
	},
};
