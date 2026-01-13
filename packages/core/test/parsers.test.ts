import { describe, expect, test } from "bun:test";
import { cargoParser, dockerParser } from "../src/parsers";

describe("dockerParser", () => {
	test("parses FROM statements with versions", () => {
		const content = `
FROM nginx:1.25.3
FROM postgres:16.1-alpine
FROM node:20.10.0-slim
`;
		const pins = dockerParser.parse(content);

		expect(pins).toHaveLength(3);
		expect(pins[0]).toMatchObject({
			package: "library/nginx",
			version: "1.25.3",
			line: 2,
			ecosystem: "docker",
		});
		expect(pins[1]).toMatchObject({
			package: "library/postgres",
			version: "16.1-alpine",
			line: 3,
		});
		expect(pins[2]).toMatchObject({
			package: "library/node",
			version: "20.10.0-slim",
			line: 4,
		});
	});

	test("skips latest, dev, and other non-version tags", () => {
		const content = `
FROM nginx:latest
FROM nginx
FROM nginx:dev
FROM nginx:nightly
`;
		const pins = dockerParser.parse(content);
		expect(pins).toHaveLength(0);
	});

	test("skips digest pins", () => {
		const content = "FROM nginx@sha256:abc123def456";
		const pins = dockerParser.parse(content);
		expect(pins).toHaveLength(0);
	});

	test("parses compose image directives", () => {
		const content = `
services:
  web:
    image: nginx:1.25.3
  db:
    image: postgres:16.1
`;
		const pins = dockerParser.parse(content);

		expect(pins).toHaveLength(2);
		expect(pins[0]).toMatchObject({
			package: "library/nginx",
			version: "1.25.3",
		});
		expect(pins[1]).toMatchObject({
			package: "library/postgres",
			version: "16.1",
		});
	});
});

describe("cargoParser", () => {
	test("parses inline version strings", () => {
		const content = `
[dependencies]
serde = "1.0.193"
tokio = "1.35.0"
`;
		const pins = cargoParser.parse(content);

		expect(pins).toHaveLength(2);
		expect(pins[0]).toMatchObject({
			package: "serde",
			version: "1.0.193",
			ecosystem: "cargo",
		});
		expect(pins[1]).toMatchObject({
			package: "tokio",
			version: "1.35.0",
		});
	});

	test("parses table-style versions", () => {
		const content = `
[dependencies]
tokio = { version = "1.35.0", features = ["full"] }
clap = { version = "4.4.11" }
`;
		const pins = cargoParser.parse(content);

		expect(pins).toHaveLength(2);
		expect(pins[0]).toMatchObject({ package: "tokio", version: "1.35.0" });
		expect(pins[1]).toMatchObject({ package: "clap", version: "4.4.11" });
	});

	test("skips git/path/workspace dependencies", () => {
		const content = `
[dependencies]
my-lib = { git = "https://github.com/org/repo" }
local-lib = { path = "../lib" }
shared = { workspace = true }
`;
		const pins = cargoParser.parse(content);
		expect(pins).toHaveLength(0);
	});

	test("skips wildcard versions", () => {
		const content = `
[dependencies]
any-pkg = "*"
`;
		const pins = cargoParser.parse(content);
		expect(pins).toHaveLength(0);
	});

	test("parses dev-dependencies", () => {
		const content = `
[dev-dependencies]
rand = "0.8.5"
`;
		const pins = cargoParser.parse(content);

		expect(pins).toHaveLength(1);
		expect(pins[0]).toMatchObject({ package: "rand", version: "0.8.5" });
	});

	test("ignores non-dependency sections", () => {
		const content = `
[package]
name = "test"
version = "0.1.0"

[features]
default = ["std"]
`;
		const pins = cargoParser.parse(content);
		expect(pins).toHaveLength(0);
	});
});
