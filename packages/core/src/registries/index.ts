import type { Ecosystem, Registry } from "../types";
import { cratesIoRegistry } from "./crates-io";
import { dockerHubRegistry } from "./docker-hub";

export const registries: Record<string, Registry> = {
	"docker.io": dockerHubRegistry,
	"crates.io": cratesIoRegistry,
};

export function getRegistryForEcosystem(ecosystem: Ecosystem): Registry | null {
	switch (ecosystem) {
		case "docker":
			return dockerHubRegistry;
		case "cargo":
			return cratesIoRegistry;
		default:
			return null;
	}
}

export { dockerHubRegistry, cratesIoRegistry };
