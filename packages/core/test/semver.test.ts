import { describe, expect, test } from "bun:test";
import { getUpdateType, isNewerVersion, isPrerelease, parseVersion } from "../src/semver";

describe("parseVersion", () => {
	test("parses standard semver", () => {
		expect(parseVersion("1.0.0")).toBe("1.0.0");
		expect(parseVersion("1.2.3")).toBe("1.2.3");
	});

	test("handles version prefixes", () => {
		expect(parseVersion("=1.0.0")).toBe("1.0.0");
		expect(parseVersion("^1.2.3")).toBe("1.2.3");
		expect(parseVersion("~1.2.3")).toBe("1.2.3");
	});

	test("coerces partial versions", () => {
		expect(parseVersion("1")).toBe("1.0.0");
		expect(parseVersion("1.2")).toBe("1.2.0");
	});

	test("handles version suffixes", () => {
		expect(parseVersion("16.1-alpine")).toBe("16.1.0");
		expect(parseVersion("20.10.0-slim")).toBe("20.10.0");
	});
});

describe("isNewerVersion", () => {
	test("detects newer versions", () => {
		expect(isNewerVersion("1.0.0", "1.0.1")).toBe(true);
		expect(isNewerVersion("1.0.0", "1.1.0")).toBe(true);
		expect(isNewerVersion("1.0.0", "2.0.0")).toBe(true);
	});

	test("returns false for same or older versions", () => {
		expect(isNewerVersion("1.0.0", "1.0.0")).toBe(false);
		expect(isNewerVersion("1.0.1", "1.0.0")).toBe(false);
	});
});

describe("getUpdateType", () => {
	test("identifies major updates", () => {
		expect(getUpdateType("1.0.0", "2.0.0")).toBe("major");
		expect(getUpdateType("1.5.3", "2.0.0")).toBe("major");
	});

	test("identifies minor updates", () => {
		expect(getUpdateType("1.0.0", "1.1.0")).toBe("minor");
		expect(getUpdateType("1.0.0", "1.5.0")).toBe("minor");
	});

	test("identifies patch updates", () => {
		expect(getUpdateType("1.0.0", "1.0.1")).toBe("patch");
		expect(getUpdateType("1.0.0", "1.0.99")).toBe("patch");
	});

	test("returns null for same version", () => {
		expect(getUpdateType("1.0.0", "1.0.0")).toBe(null);
	});
});

describe("isPrerelease", () => {
	test("detects prerelease versions", () => {
		expect(isPrerelease("1.0.0-alpha")).toBe(true);
		expect(isPrerelease("1.0.0-beta.1")).toBe(true);
		expect(isPrerelease("1.0.0-rc.1")).toBe(true);
	});

	test("returns false for stable versions", () => {
		expect(isPrerelease("1.0.0")).toBe(false);
		expect(isPrerelease("2.3.4")).toBe(false);
	});
});
