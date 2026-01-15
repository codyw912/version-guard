import { describe, expect, test } from "bun:test";
import { getNestedProp } from "../src/index";

describe("getNestedProp", () => {
	test("extracts shallow property", () => {
		const obj = { tool: "edit" };
		expect(getNestedProp(obj, "tool")).toBe("edit");
	});

	test("extracts deeply nested property", () => {
		const obj = {
			metadata: {
				filediff: {
					file: "/path/to/file.ts",
				},
			},
		};
		expect(getNestedProp(obj, "metadata", "filediff", "file")).toBe("/path/to/file.ts");
	});

	test("returns undefined for missing property", () => {
		const obj = { tool: "edit" };
		expect(getNestedProp(obj, "missing")).toBeUndefined();
	});

	test("returns undefined for missing nested property", () => {
		const obj = { metadata: {} };
		expect(getNestedProp(obj, "metadata", "filediff", "file")).toBeUndefined();
	});

	test("handles null object", () => {
		expect(getNestedProp(null, "key")).toBeUndefined();
	});

	test("handles undefined object", () => {
		expect(getNestedProp(undefined, "key")).toBeUndefined();
	});

	test("handles null in chain", () => {
		const obj = { metadata: null };
		expect(getNestedProp(obj, "metadata", "filediff")).toBeUndefined();
	});

	test("handles array access", () => {
		const obj = { items: ["a", "b", "c"] };
		expect(getNestedProp(obj, "items", "1")).toBe("b");
	});
});

describe("hook input/output structure", () => {
	test("extracts tool name from input", () => {
		const input = {
			tool: "edit",
			sessionID: "ses_123",
			callID: "call_456",
		};
		const toolName = String(getNestedProp(input, "tool") ?? "").toLowerCase();
		expect(toolName).toBe("edit");
	});

	test("extracts filePath from edit output metadata", () => {
		const output = {
			title: "Dockerfile",
			output: "Edit applied successfully.",
			metadata: {
				filediff: {
					file: "/path/to/Dockerfile",
					before: "FROM nginx:1.24.0",
					after: "FROM nginx:1.25.0",
					additions: 1,
					deletions: 1,
				},
			},
		};
		const filePath = getNestedProp(output, "metadata", "filediff", "file");
		expect(filePath).toBe("/path/to/Dockerfile");
	});

	test("extracts content from edit output metadata", () => {
		const output = {
			metadata: {
				filediff: {
					file: "/path/to/Dockerfile",
					after: "FROM nginx:1.25.0\nEXPOSE 80",
				},
			},
		};
		const content = getNestedProp(output, "metadata", "filediff", "after");
		expect(content).toBe("FROM nginx:1.25.0\nEXPOSE 80");
	});

	test("handles write tool output structure", () => {
		// Write tool may have different metadata structure
		const output = {
			metadata: {
				file: "/path/to/file.ts",
				content: "console.log('hello');",
			},
		};
		const filePath =
			getNestedProp(output, "metadata", "filediff", "file") ??
			getNestedProp(output, "metadata", "file");
		expect(filePath).toBe("/path/to/file.ts");
	});

	test("skips non-edit/write tools", () => {
		const input = { tool: "read" };
		const toolName = String(getNestedProp(input, "tool") ?? "").toLowerCase();
		const shouldProcess = toolName === "edit" || toolName === "write";
		expect(shouldProcess).toBe(false);
	});
});
