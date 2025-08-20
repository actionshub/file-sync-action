import type { NormalizedInputs } from './inputs'

/**
 * Determine the sync configuration file path.
 * If not explicitly provided via CONFIG_PATH (normalized to inputs.config_path),
 * default to `.github/sync.yml`.
 */
export function resolveConfigPath(inputs: NormalizedInputs): string {
  return inputs.config_path && inputs.config_path.trim().length > 0
    ? inputs.config_path
    : '.github/sync.yml'
}
