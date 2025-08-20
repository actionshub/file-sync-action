import fs from 'fs-extra'
import YAML from 'yaml'
import { RepoFileSpec, SyncConfig, SyncConfigSchema } from './schemas'

export function parseSyncConfigFromString (yamlString: string): SyncConfig {
  const obj = YAML.parse(yamlString)
  const parsed = SyncConfigSchema.parse(obj)
  return parsed as SyncConfig
}

export async function parseSyncConfigFile (filePath: string): Promise<SyncConfig> {
  const exists = await fs.pathExists(filePath)
  if (!exists) {
    throw new Error(`Config file not found: ${filePath}`)
  }
  const raw = await fs.readFile(filePath, 'utf8')
  return parseSyncConfigFromString(raw)
}
