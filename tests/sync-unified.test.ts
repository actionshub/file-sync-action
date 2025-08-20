import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import os from 'node:os'
import path from 'node:path'
import fs from 'fs-extra'
import simpleGit from 'simple-git'
import { syncPath } from '../src/sync'

interface TestRepo {
  dir: string
  cleanup: () => Promise<void>
}

async function createTempRepo(): Promise<TestRepo> {
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'repo-sync-target-'))
  const git = simpleGit({ baseDir: tmpRoot })
  await git.init()
  await git.addConfig('user.email', 'repo-sync@example.com')
  await git.addConfig('user.name', 'Repo Sync Action')
  await git.addConfig('commit.gpgsign', 'false')
  await fs.writeFile(path.join(tmpRoot, '.gitignore'), 'node_modules\n')
  await git.add('.')
  await git.commit('chore: init')
  return {
    dir: tmpRoot,
    cleanup: async () => {
      await fs.remove(tmpRoot)
    }
  }
}

async function createSourceStructure(): Promise<TestRepo> {
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'repo-sync-source-'))
  
  // Create test files and directories
  await fs.ensureDir(path.join(tmpRoot, 'templates'))
  await fs.ensureDir(path.join(tmpRoot, 'workflows'))
  await fs.ensureDir(path.join(tmpRoot, 'docs'))
  
  // Single files
  await fs.writeFile(path.join(tmpRoot, 'README.md'), '# Test README\n')
  await fs.writeFile(path.join(tmpRoot, '.editorconfig'), 'root = true\n')
  
  // Template files
  await fs.writeFile(path.join(tmpRoot, 'templates/README.md'), '# Template README\n')
  await fs.writeFile(path.join(tmpRoot, 'templates/LICENSE'), 'MIT License\n')
  
  // Workflow files (for glob testing)
  await fs.writeFile(path.join(tmpRoot, 'workflows/test.yml'), 'name: test\n')
  await fs.writeFile(path.join(tmpRoot, 'workflows/lint.yml'), 'name: lint\n')
  await fs.writeFile(path.join(tmpRoot, 'workflows/deploy.yml'), 'name: deploy\n')
  
  // Documentation folder
  await fs.writeFile(path.join(tmpRoot, 'docs/guide.md'), '# Guide\n')
  await fs.writeFile(path.join(tmpRoot, 'docs/api.md'), '# API\n')
  
  return {
    dir: tmpRoot,
    cleanup: async () => {
      await fs.remove(tmpRoot)
    }
  }
}

describe('syncPath unified (file, glob, folder)', () => {
  let sourceRepo: TestRepo
  let targetRepo: TestRepo

  beforeEach(async () => {
    sourceRepo = await createSourceStructure()
    targetRepo = await createTempRepo()
  })

  afterEach(async () => {
    await sourceRepo.cleanup()
    await targetRepo.cleanup()
  })

  it('syncs a single file', async () => {
    const result = await syncPath({
      sourcePath: path.join(sourceRepo.dir, 'README.md'),
      targetDir: targetRepo.dir,
      dest: 'README.md'
    })

    expect(result.changed).toEqual(['README.md'])
    expect(await fs.pathExists(path.join(targetRepo.dir, 'README.md'))).toBe(true)
    const content = await fs.readFile(path.join(targetRepo.dir, 'README.md'), 'utf8')
    expect(content).toBe('# Test README\n')
  })

  it('syncs a single file to different destination', async () => {
    const result = await syncPath({
      sourcePath: path.join(sourceRepo.dir, 'templates/README.md'),
      targetDir: targetRepo.dir,
      dest: 'docs/README.md'
    })

    expect(result.changed).toEqual(['docs/README.md'])
    expect(await fs.pathExists(path.join(targetRepo.dir, 'docs/README.md'))).toBe(true)
    const content = await fs.readFile(path.join(targetRepo.dir, 'docs/README.md'), 'utf8')
    expect(content).toBe('# Template README\n')
  })

  it('syncs files matching a glob pattern', async () => {
    const result = await syncPath({
      sourcePath: path.join(sourceRepo.dir, 'workflows/*.yml'),
      targetDir: targetRepo.dir,
      dest: '.github/workflows'
    })

    expect(result.changed.sort()).toEqual([
      '.github/workflows/deploy.yml',
      '.github/workflows/lint.yml',
      '.github/workflows/test.yml'
    ])
    
    expect(await fs.pathExists(path.join(targetRepo.dir, '.github/workflows/test.yml'))).toBe(true)
    expect(await fs.pathExists(path.join(targetRepo.dir, '.github/workflows/lint.yml'))).toBe(true)
    expect(await fs.pathExists(path.join(targetRepo.dir, '.github/workflows/deploy.yml'))).toBe(true)
  })

  it('syncs an entire folder', async () => {
    const result = await syncPath({
      sourcePath: path.join(sourceRepo.dir, 'docs'),
      targetDir: targetRepo.dir,
      dest: 'documentation'
    })

    expect(result.changed.sort()).toEqual([
      'documentation/api.md',
      'documentation/guide.md'
    ])
    
    expect(await fs.pathExists(path.join(targetRepo.dir, 'documentation/guide.md'))).toBe(true)
    expect(await fs.pathExists(path.join(targetRepo.dir, 'documentation/api.md'))).toBe(true)
  })

  it('is idempotent - no changes on second run', async () => {
    // First sync
    const result1 = await syncPath({
      sourcePath: path.join(sourceRepo.dir, 'workflows/*.yml'),
      targetDir: targetRepo.dir,
      dest: '.github/workflows'
    })
    expect(result1.changed.length).toBeGreaterThan(0)

    // Second sync should detect no changes
    const result2 = await syncPath({
      sourcePath: path.join(sourceRepo.dir, 'workflows/*.yml'),
      targetDir: targetRepo.dir,
      dest: '.github/workflows'
    })
    expect(result2.changed).toEqual([])
  })

  it('detects changes when source file is modified', async () => {
    // Initial sync
    await syncPath({
      sourcePath: path.join(sourceRepo.dir, 'README.md'),
      targetDir: targetRepo.dir,
      dest: 'README.md'
    })

    // Modify source file
    await fs.writeFile(path.join(sourceRepo.dir, 'README.md'), '# Updated README\n')

    // Sync again
    const result = await syncPath({
      sourcePath: path.join(sourceRepo.dir, 'README.md'),
      targetDir: targetRepo.dir,
      dest: 'README.md'
    })

    expect(result.changed).toEqual(['README.md'])
    const content = await fs.readFile(path.join(targetRepo.dir, 'README.md'), 'utf8')
    expect(content).toBe('# Updated README\n')
  })

  it('handles non-existent source path', async () => {
    await expect(syncPath({
      sourcePath: path.join(sourceRepo.dir, 'non-existent.txt'),
      targetDir: targetRepo.dir,
      dest: 'test.txt'
    })).rejects.toThrow('Source path not found')
  })

  it('handles glob with no matches', async () => {
    const result = await syncPath({
      sourcePath: path.join(sourceRepo.dir, 'workflows/*.json'),
      targetDir: targetRepo.dir,
      dest: '.github/workflows'
    })

    expect(result.changed).toEqual([])
  })
})
