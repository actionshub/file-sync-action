import { describe, it, expect } from 'vitest'
import fs from 'fs-extra'
import YAML from 'yaml'

interface ActionYml {
  inputs?: Record<string, any>
}

describe('action.yml inputs contract', () => {
  it('defines expected inputs including alias and reviewers', async () => {
    const raw = await fs.readFile('action.yml', 'utf8')
    const doc = YAML.parse(raw) as ActionYml
    expect(doc).toBeTruthy()
    expect(doc.inputs).toBeTruthy()

    const inputs = doc.inputs as Record<string, any>

    // Core input
    expect(inputs.search_topics, 'search_topics must exist').toBeTruthy()

    // Reviewers
    expect(inputs.reviewers, 'lowercase reviewers input should exist').toBeTruthy()
    expect(inputs.team_reviewers, 'team_reviewers should exist').toBeTruthy()

    // Compatibility inputs
    expect(inputs.CONFIG_PATH, 'CONFIG_PATH should exist').toBeTruthy()
    expect(inputs.COMMIT_EACH_FILE, 'COMMIT_EACH_FILE should exist').toBeTruthy()
  })
})
