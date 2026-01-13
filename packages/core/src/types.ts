export type Ecosystem = "docker" | "cargo";

export type UpdateType = "major" | "minor" | "patch";

export type Severity = "error" | "warn" | "info" | "ignore";

export interface VersionPin {
	package: string;
	version: string;
	line: number;
	ecosystem: Ecosystem;
	registry?: string;
}

export interface VersionWarning {
	file: string;
	line: number;
	ecosystem: Ecosystem;
	package: string;
	current: string;
	latest: string;
	updateType: UpdateType;
}

export interface Parser {
	ecosystem: Ecosystem;
	filePatterns: RegExp[];
	parse(content: string): VersionPin[];
}

export interface Registry {
	name: string;
	getLatestVersion(pkg: string): Promise<string | null>;
	supports(pkg: string): boolean;
}

export interface DockerConfig {
	enabled: boolean;
	registries: string[];
	ignoreTags: string[];
	ignoreImages: string[];
}

export interface CargoConfig {
	enabled: boolean;
	ignorePrerelease: boolean;
	ignoreCrates: string[];
}

export interface SeverityConfig {
	major: Severity;
	minor: Severity;
	patch: Severity;
}

export interface CacheConfig {
	ttlMinutes: number;
}

export interface VersionGuardConfig {
	enabled: boolean;
	docker: DockerConfig;
	cargo: CargoConfig;
	severity: SeverityConfig;
	cache: CacheConfig;
	ignore: string[];
	batchSize: number;
	batchDelayMs: number;
}
