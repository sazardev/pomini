// Bumps version in package.json based on conventional commits since last tag
// Usage: node scripts/bump-version.js [patch|minor|major]
// Auto-detects from commits if no arg given

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const pkgPath = path.join(__dirname, '..', 'package.json')
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
const current = pkg.version

function getCommitsSinceLastTag() {
  try {
    const lastTag = execSync('git describe --tags --abbrev=0 2>nul', { encoding: 'utf8' }).trim()
    return execSync(`git log ${lastTag}..HEAD --pretty=format:"%s"`, { encoding: 'utf8' })
  } catch {
    return execSync('git log --pretty=format:"%s"', { encoding: 'utf8' })
  }
}

function detectBump(commits) {
  const lines = commits.split('\n').filter(Boolean)
  let bump = 'patch'

  for (const line of lines) {
    const lower = line.toLowerCase()
    if (lower.includes('breaking change') || lower.startsWith('feat!') || lower.startsWith('fix!')) {
      bump = 'major'
      break
    }
    if (lower.startsWith('feat') || lower.startsWith('feat:')) {
      bump = 'minor'
    }
  }
  return bump
}

function bumpVersion(ver, type) {
  const [major, minor, patch] = ver.split('.').map(Number)
  switch (type) {
    case 'major': return `${major + 1}.0.0`
    case 'minor': return `${major}.${minor + 1}.0`
    case 'patch': default: return `${major}.${minor}.${patch + 1}`
  }
}

const bumpType = process.argv[2] || detectBump(getCommitsSinceLastTag())
const newVersion = bumpVersion(current, bumpType)

pkg.version = newVersion
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8')

execSync('git add package.json')
execSync(`git commit -m "chore: bump version to ${newVersion}"`, { stdio: 'inherit' })

const tag = `v${newVersion}`
execSync(`git tag -a ${tag} -m "Release ${tag}"`)
execSync('git push origin HEAD --follow-tags', { stdio: 'inherit' })

console.log(`Bumped ${current} → ${newVersion} (${bumpType})`)
console.log(`Tagged ${tag}`)
