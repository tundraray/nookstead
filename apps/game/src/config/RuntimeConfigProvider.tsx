'use client';

import { useRef } from 'react';
import { setRuntimeConfig, type RuntimeConfig } from './runtime';

/**
 * Injects server-side runtime config into the client module.
 *
 * Rendered once in the root layout — the server component reads env vars
 * and passes them as props. This component calls `setRuntimeConfig`
 * synchronously during render so the values are available before any
 * effects or event handlers run.
 */
export function RuntimeConfigProvider(props: Partial<RuntimeConfig>) {
  const initialized = useRef(false);
  if (!initialized.current) {
    setRuntimeConfig(props);
    initialized.current = true;
  }
  return null;
}
