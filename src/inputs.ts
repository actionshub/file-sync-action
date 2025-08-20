import { StringUtils, ArrayUtils, createInputParser } from './utils'

export const parsePrTags = StringUtils.parsePrTags

export interface NormalizedInputs {
  token: string
  labels: string[]
  dry_run: boolean
  search_topics: string[]
  reviewers: string[]
  team_reviewers: string[]
  assignees: string[]
  pr_body?: string
  commit_prefix?: string
  commit_body?: string
  pr_title?: string
  branch_name?: string
  branch_prefix?: string
  skip_pr?: boolean
  tmp_dir?: string
  skip_cleanup?: boolean
  overwrite_existing_pr?: boolean
  commit_as_pr_title?: boolean
  original_message?: boolean
  is_fine_grained?: boolean
  git_email?: string
  git_username?: string
  fork?: string
  commit_each_file?: boolean
  config_path?: string
}

// Create input parsers with fallback support
const parseStringInput = createInputParser(StringUtils.strOrUndefined)
const parseBoolInput = createInputParser(StringUtils.parseBool)
const parseListInput = createInputParser(StringUtils.parseNewlineList)

/**
 * Parse token inputs with precedence: token > GH_INSTALLATION_TOKEN > GH_PAT
 */
function parseTokenInputs(raw: Record<string, any>) {
  const token = parseStringInput(raw, 'token', ['GH_INSTALLATION_TOKEN', 'GH_PAT']) || ''
  return { token }
}

/**
 * Parse all list-based inputs (labels, reviewers, assignees)
 */
function parseListInputs(raw: Record<string, any>) {
  const labels = ArrayUtils.dedupeStrings([
    ...parseListInput(raw, 'labels'),
    ...StringUtils.parsePrTags(raw.pr_tags),
    ...parseListInput(raw, 'PR_LABELS')
  ])

  const search_topics = StringUtils.parseTopicList(raw.search_topics)

  const reviewers = ArrayUtils.dedupeStrings([
    ...parseListInput(raw, 'reviewers'),
    ...parseListInput(raw, 'REVIEWERS')
  ])

  const team_reviewers = ArrayUtils.dedupeStrings([
    ...parseListInput(raw, 'team_reviewers'),
    ...parseListInput(raw, 'TEAM_REVIEWERS')
  ])

  const assignees = ArrayUtils.dedupeStrings([
    ...parseListInput(raw, 'assignees'),
    ...parseListInput(raw, 'ASSIGNEES')
  ])

  return { labels, search_topics, reviewers, team_reviewers, assignees }
}

/**
 * Parse all boolean inputs
 */
function parseBooleanInputs(raw: Record<string, any>) {
  const dry_run = parseBoolInput(raw, 'dry_run', ['DRY_RUN']) ?? false
  const skip_pr = StringUtils.parseBool(raw.SKIP_PR)
  const skip_cleanup = StringUtils.parseBool(raw.SKIP_CLEANUP)
  const overwrite_existing_pr = StringUtils.parseBool(raw.OVERWRITE_EXISTING_PR)
  const commit_as_pr_title = StringUtils.parseBool(raw.COMMIT_AS_PR_TITLE)
  const original_message = StringUtils.parseBool(raw.ORIGINAL_MESSAGE)
  const is_fine_grained = StringUtils.parseBool(raw.IS_FINE_GRAINED)
  const commit_each_file = StringUtils.parseBool(raw.COMMIT_EACH_FILE)

  return {
    dry_run,
    skip_pr,
    skip_cleanup,
    overwrite_existing_pr,
    commit_as_pr_title,
    original_message,
    is_fine_grained,
    commit_each_file
  }
}

/**
 * Parse all string inputs with fallback support
 */
function parseStringInputs(raw: Record<string, any>) {
  const pr_body = parseStringInput(raw, 'pr_body', ['PR_BODY'])
  const commit_prefix = parseStringInput(raw, 'commit_prefix', ['COMMIT_PREFIX'])
  const commit_body = StringUtils.strOrUndefined(raw.COMMIT_BODY)
  const pr_title = parseStringInput(raw, 'pr_title', ['PR_TITLE'])
  const branch_name = StringUtils.strOrUndefined(raw.branch_name)
  const branch_prefix = StringUtils.strOrUndefined(raw.BRANCH_PREFIX)
  const tmp_dir = StringUtils.strOrUndefined(raw.TMP_DIR)
  const git_email = StringUtils.strOrUndefined(raw.GIT_EMAIL)
  const git_username = StringUtils.strOrUndefined(raw.GIT_USERNAME)
  const fork = StringUtils.strOrUndefined(raw.FORK)
  const config_path = StringUtils.strOrUndefined(raw.CONFIG_PATH)

  return {
    pr_body,
    commit_prefix,
    commit_body,
    pr_title,
    branch_name,
    branch_prefix,
    tmp_dir,
    git_email,
    git_username,
    fork,
    config_path
  }
}

export function normalizeActionInputs(raw: Record<string, any>): NormalizedInputs {
  return {
    ...parseTokenInputs(raw),
    ...parseListInputs(raw),
    ...parseBooleanInputs(raw),
    ...parseStringInputs(raw)
  }
}
