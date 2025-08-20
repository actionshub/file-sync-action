import path from 'node:path'
import fs from 'fs-extra'
import { glob } from 'glob'

export interface SyncSubfolderOptions {
  sourceDir: string
  targetDir: string
  dest?: string // destination path within targetDir
}

export interface SyncResult {
  changed: string[] // list of changed file paths relative to target destination
}

export interface SyncPathOptions {
  sourcePath: string // can be file, glob pattern, or directory
  targetDir: string
  dest?: string // destination path within targetDir
}

function isGitDir (p: string): boolean {
  const parts = p.split(path.sep)
  return parts.includes('.git')
}

async function listFilesRecursively (dir: string): Promise<string[]> {
  const out: string[] = []
  const entries = await fs.readdir(dir, { withFileTypes: true })
  for (const ent of entries) {
    const abs = path.join(dir, ent.name)
    if (isGitDir(abs)) continue
    if (ent.isDirectory()) {
      const sub = await listFilesRecursively(abs)
      out.push(...sub)
    } else if (ent.isFile()) {
      out.push(abs)
    }
  }
  return out
}

async function filesDiffer (src: string, dst: string): Promise<boolean> {
  const dstExists = await fs.pathExists(dst)
  if (!dstExists) return true

  const [a, b] = await Promise.all([fs.stat(src), fs.stat(dst)])
  if (a.size !== b.size) return true

  const [bufA, bufB] = await Promise.all([fs.readFile(src), fs.readFile(dst)])
  return !bufA.equals(bufB)
}

export async function syncSubfolder (opts: SyncSubfolderOptions): Promise<SyncResult> {
  const sourceDir = path.resolve(opts.sourceDir)
  const targetDir = path.resolve(opts.targetDir)
  const dest = opts.dest ? opts.dest : '.'
  const destRoot = path.resolve(targetDir, dest)

  const changed: string[] = []

  const files = await listFilesRecursively(sourceDir)
  for (const absSrc of files) {
    const relFromSource = path.relative(sourceDir, absSrc)
    const absDst = path.join(destRoot, relFromSource)
    await fs.ensureDir(path.dirname(absDst))

    if (await filesDiffer(absSrc, absDst)) {
      await fs.copy(absSrc, absDst, { overwrite: true })
      const relChanged = path.relative(destRoot, absDst) || path.basename(absDst)
      changed.push(relChanged)
    }
  }

  return { changed }
}

/**
 * Unified sync function that handles files, glob patterns, and directories.
 * Automatically detects the type of source path and handles accordingly.
 */
export async function syncPath(opts: SyncPathOptions): Promise<SyncResult> {
  const { sourcePath, targetDir, dest = '.' } = opts
  const targetRoot = path.resolve(targetDir)
  const destRoot = path.resolve(targetRoot, dest)
  
  const changed: string[] = []
  
  // Check if sourcePath contains glob patterns
  const hasGlobPattern = sourcePath.includes('*') || sourcePath.includes('?') || sourcePath.includes('[')
  
  if (hasGlobPattern) {
    // Handle glob pattern
    const matches = await glob(sourcePath, { nodir: true })
    
    if (matches.length === 0) {
      return { changed: [] }
    }
    
    for (const match of matches) {
      const fileName = path.basename(match)
      const targetPath = path.join(destRoot, fileName)
      await fs.ensureDir(path.dirname(targetPath))
      
      if (await filesDiffer(match, targetPath)) {
        await fs.copy(match, targetPath, { overwrite: true })
        const relChanged = path.relative(targetRoot, targetPath) || path.basename(targetPath)
        changed.push(relChanged)
      }
    }
  } else {
    // Check if source exists
    const sourceExists = await fs.pathExists(sourcePath)
    if (!sourceExists) {
      throw new Error(`Source path not found: ${sourcePath}`)
    }
    
    const sourceStat = await fs.stat(sourcePath)
    
    if (sourceStat.isFile()) {
      // Handle single file
      await fs.ensureDir(path.dirname(destRoot))
      
      if (await filesDiffer(sourcePath, destRoot)) {
        await fs.copy(sourcePath, destRoot, { overwrite: true })
        const relChanged = path.relative(targetRoot, destRoot) || path.basename(destRoot)
        changed.push(relChanged)
      }
    } else if (sourceStat.isDirectory()) {
      // Handle directory (existing logic)
      const files = await listFilesRecursively(sourcePath)
      for (const absSrc of files) {
        const relFromSource = path.relative(sourcePath, absSrc)
        const absDst = path.join(destRoot, relFromSource)
        await fs.ensureDir(path.dirname(absDst))
        
        if (await filesDiffer(absSrc, absDst)) {
          await fs.copy(absSrc, absDst, { overwrite: true })
          const relChanged = path.relative(targetRoot, absDst) || path.basename(absDst)
          changed.push(relChanged)
        }
      }
    }
  }
  
  return { changed }
}
