interface CacheEntry {
	version: string;
	timestamp: number;
}

export class VersionCache {
	private cache = new Map<string, CacheEntry>();
	private ttlMs: number;

	constructor(ttlMinutes = 10) {
		this.ttlMs = ttlMinutes * 60 * 1000;
	}

	get(key: string): string | null {
		const entry = this.cache.get(key);
		if (!entry) return null;
		if (Date.now() - entry.timestamp > this.ttlMs) {
			this.cache.delete(key);
			return null;
		}
		return entry.version;
	}

	set(key: string, version: string): void {
		this.cache.set(key, { version, timestamp: Date.now() });
	}

	has(key: string): boolean {
		return this.get(key) !== null;
	}

	prune(): void {
		const now = Date.now();
		for (const [key, entry] of this.cache) {
			if (now - entry.timestamp > this.ttlMs) {
				this.cache.delete(key);
			}
		}
	}

	clear(): void {
		this.cache.clear();
	}

	get size(): number {
		return this.cache.size;
	}
}
