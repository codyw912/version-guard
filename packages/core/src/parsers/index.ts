import type { Parser } from "../types";
import { cargoParser } from "./cargo";
import { dockerParser } from "./docker";

export const parsers: Parser[] = [dockerParser, cargoParser];

export function getParserForFile(filename: string): Parser | null {
	for (const parser of parsers) {
		for (const pattern of parser.filePatterns) {
			if (pattern.test(filename)) {
				return parser;
			}
		}
	}
	return null;
}

export { dockerParser, cargoParser };
