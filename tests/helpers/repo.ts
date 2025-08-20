import fs from 'node:fs'
import path from 'node:path'

export function findRepoRoot (start: string): string {
  let dir = start
  for (let i = 0; i < 20; i++) {
    if (fs.existsSync(path.join(dir, '.git'))) return dir
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  throw new Error('Could not find repo root from: ' + start)
}
