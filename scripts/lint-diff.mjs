import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { extname, join, relative, resolve } from 'node:path'
import { ESLint } from 'eslint'

const baseRef = process.env.GITHUB_BASE_REF ||
  (process.env.GITHUB_REF_NAME === 'implementation/hero-identity'
    ? 'architecture/core-foundation'
    : process.env.GITHUB_REF_NAME || 'architecture/core-foundation')

execFileSync('git', ['fetch', 'origin', baseRef], { stdio: 'inherit' })

const changedFiles = execFileSync(
  'git',
  ['diff', '--name-only', '--diff-filter=ACMR', `origin/${baseRef}...HEAD`],
  { encoding: 'utf8' },
).trim().split('\n').filter(Boolean)

const lintableExtensions = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'])
const files = changedFiles.filter(file => lintableExtensions.has(extname(file)) && existsSync(resolve(file)))

if (files.length === 0) {
  console.log('No changed JavaScript/TypeScript files to lint.')
  process.exit(0)
}

const baseDir = mkdtempSync(join(tmpdir(), 'wodos-eslint-base-'))
try {
  execFileSync('git', ['worktree', 'add', '--detach', baseDir, `origin/${baseRef}`], { stdio: 'inherit' })
  symlinkSync(resolve('node_modules'), join(baseDir, 'node_modules'), 'dir')

  const currentEslint = new ESLint({ cwd: process.cwd() })
  const baselineEslint = new ESLint({ cwd: baseDir })
  const baselineFiles = files.filter(file => existsSync(join(baseDir, file)))

  const [currentResults, baselineResults] = await Promise.all([
    currentEslint.lintFiles(files),
    baselineFiles.length ? baselineEslint.lintFiles(baselineFiles) : Promise.resolve([]),
  ])

  const toCounts = (results, cwd) => {
    const counts = new Map()
    for (const result of results) {
      const file = relative(cwd, result.filePath)
      for (const message of result.messages) {
        if (message.severity === 0) continue
        const key = [file, message.ruleId || 'fatal', message.message, (message.source || '').trim()].join('\u0000')
        counts.set(key, (counts.get(key) || 0) + 1)
      }
    }
    return counts
  }

  const currentCounts = toCounts(currentResults, process.cwd())
  const baselineCounts = toCounts(baselineResults, baseDir)
  const regressions = []

  for (const [key, count] of currentCounts) {
    const added = count - (baselineCounts.get(key) || 0)
    for (let i = 0; i < added; i++) regressions.push(key.split('\u0000'))
  }

  const currentTotal = [...currentCounts.values()].reduce((sum, count) => sum + count, 0)
  const baselineTotal = [...baselineCounts.values()].reduce((sum, count) => sum + count, 0)
  console.log(`Changed files checked: ${files.length}`)
  console.log(`Existing findings in those files: ${baselineTotal}`)
  console.log(`Current findings in those files: ${currentTotal}`)
  console.log(`New lint findings: ${regressions.length}`)

  if (regressions.length) {
    for (const [file, rule, message, source] of regressions) {
      console.error(`NEW ${file} [${rule}] ${message}${source ? ` | ${source}` : ''}`)
    }
    process.exitCode = 1
  }
} finally {
  try { execFileSync('git', ['worktree', 'remove', '--force', baseDir], { stdio: 'ignore' }) } catch {}
  rmSync(baseDir, { recursive: true, force: true })
}
