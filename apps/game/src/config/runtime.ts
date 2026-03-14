/**
 * Runtime configuration populated via SSR.
 *
 * Server components read environment variables and pass them to
 * `RuntimeConfigProvider`, which calls `setRuntimeConfig` on mount.
 * Client code reads values via `getRuntimeConfig`.
 */

export interface RuntimeConfig {
  colyseusUrl: string;
  dayCycleMs: number;
}

const DEFAULT_CONFIG: RuntimeConfig = {
  colyseusUrl: 'ws://localhost:2567',
  dayCycleMs: 3_600_000,
};

let config: RuntimeConfig = { ...DEFAULT_CONFIG };

export function setRuntimeConfig(cfg: Partial<RuntimeConfig>): void {
  config = { ...config, ...cfg };
}

export function getRuntimeConfig(): RuntimeConfig {
  return config;
}
