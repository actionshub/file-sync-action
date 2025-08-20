import { z } from 'zod'

/**
 * Common Zod schemas used across the application
 */
export const CommonSchemas = {
  nonEmptyString: z.string().min(1),
  repoFormat: z.string().regex(/^[^/]+\/[^/]+$/, 'repo must be in owner/repo format'),
  positiveInt: z.number().int().positive(),
  optionalString: z.string().optional(),
  optionalPositiveInt: z.number().int().positive().optional(),
  optionalBoolean: z.boolean().optional(),
  stringArray: z.array(z.string().min(1)).min(1)
}

/**
 * Schema for repository discovery options
 */
export const DiscoverOptionsSchema = z.object({
  org: CommonSchemas.nonEmptyString.describe('org is required'),
  search_topics: CommonSchemas.stringArray.describe('at least one topic is required')
})

/**
 * Schema for source path options
 */
export const GetSourcePathOptionsSchema = z.object({
  repo: CommonSchemas.repoFormat,
  path: CommonSchemas.nonEmptyString.describe('path is required'),
  token: CommonSchemas.nonEmptyString.describe('token is required'),
  ref: CommonSchemas.optionalString,
  depth: CommonSchemas.optionalPositiveInt,
  sparse: CommonSchemas.optionalBoolean
})

/**
 * Schema for file specifications in sync config
 */
export const FileSpecSchema = z.union([
  CommonSchemas.nonEmptyString,
  z.object({
    source: CommonSchemas.nonEmptyString,
    dest: CommonSchemas.nonEmptyString
  }).strict()
])

/**
 * Schema for sync configuration
 */
export const SyncConfigSchema = z.record(z.string(), z.array(FileSpecSchema).min(1))

export type DiscoverOptions = z.infer<typeof DiscoverOptionsSchema>
export type GetSourcePathOptions = z.infer<typeof GetSourcePathOptionsSchema>
export type RepoFileSpec = z.infer<typeof FileSpecSchema>
export type SyncConfig = z.infer<typeof SyncConfigSchema>
