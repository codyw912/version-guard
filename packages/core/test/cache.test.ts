import { describe, expect, test } from "bun:test";
import { VersionCache } from "../src/cache";

describe("VersionCache", () => {
	test("stores and retrieves values", () => {
		const cache = new VersionCache(10);
		cache.set("test-key", "1.0.0");
		expect(cache.get("test-key")).toBe("1.0.0");
	});

	test("returns null for missing keys", () => {
		const cache = new VersionCache(10);
		expect(cache.get("nonexistent")).toBe(null);
	});

	test("expires entries after TTL", async () => {
		const cache = new VersionCache(0.001); // 0.06 seconds
		cache.set("test-key", "1.0.0");

		await new Promise((resolve) => setTimeout(resolve, 100));

		expect(cache.get("test-key")).toBe(null);
	});

	test("has() checks existence with TTL", () => {
		const cache = new VersionCache(10);
		expect(cache.has("test-key")).toBe(false);

		cache.set("test-key", "1.0.0");
		expect(cache.has("test-key")).toBe(true);
	});

	test("prune() removes expired entries", async () => {
		const cache = new VersionCache(0.001);
		cache.set("key1", "1.0.0");
		cache.set("key2", "2.0.0");

		await new Promise((resolve) => setTimeout(resolve, 100));

		expect(cache.size).toBe(2);
		cache.prune();
		expect(cache.size).toBe(0);
	});

	test("clear() removes all entries", () => {
		const cache = new VersionCache(10);
		cache.set("key1", "1.0.0");
		cache.set("key2", "2.0.0");

		expect(cache.size).toBe(2);
		cache.clear();
		expect(cache.size).toBe(0);
	});
});
