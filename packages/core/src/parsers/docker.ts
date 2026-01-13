import type { Parser, VersionPin } from "../types";

// Match FROM <image>:<tag> or image: <image>:<tag>
const FROM_PATTERN =
	/^\s*FROM\s+(?:(?<registry>[^/\s]+)\/)?(?<image>[^:\s@]+):(?<tag>v?\d+(?:\.\d+){0,2}[^\s@]*)/i;
const IMAGE_PATTERN =
	/^\s*image:\s*(?:(?<registry>[^/\s]+)\/)?(?<image>[^:\s@]+):(?<tag>v?\d+(?:\.\d+){0,2}[^\s@]*)/i;

const IGNORED_TAGS = new Set([
	"latest",
	"dev",
	"nightly",
	"edge",
	"canary",
	"alpha",
	"beta",
	"rc",
	"main",
	"master",
]);

function isVersionTag(tag: string): boolean {
	if (IGNORED_TAGS.has(tag.toLowerCase())) return false;
	if (tag.includes("@sha256:")) return false;
	// Must start with a digit or 'v' followed by digit
	return /^v?\d/.test(tag);
}

function extractImageName(image: string, registry?: string): string {
	// For official images (no registry or docker.io), use library/ prefix internally
	if (!registry || registry === "docker.io") {
		return image.includes("/") ? image : `library/${image}`;
	}
	return `${registry}/${image}`;
}

export const dockerParser: Parser = {
	ecosystem: "docker",
	filePatterns: [
		/^Dockerfile/i,
		/\.dockerfile$/i,
		/docker-compose.*\.ya?ml$/i,
		/compose.*\.ya?ml$/i,
	],

	parse(content: string): VersionPin[] {
		const pins: VersionPin[] = [];
		const lines = content.split("\n");

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			const lineNum = i + 1;

			// Try both patterns
			const match = FROM_PATTERN.exec(line) || IMAGE_PATTERN.exec(line);
			if (!match?.groups) continue;

			const { registry, image, tag } = match.groups;

			if (!isVersionTag(tag)) continue;

			pins.push({
				package: extractImageName(image, registry),
				version: tag,
				line: lineNum,
				ecosystem: "docker",
				registry: registry || "docker.io",
			});
		}

		return pins;
	},
};
