const { execSync } = require('child_process')

function usingPnpm() {
  try {
    const pm = process.env.npm_execpath || ''
    return pm.includes('pnpm') || process.env.npm_config_user_agent?.includes('pnpm')
  } catch (e) {
    return false
  }
}

if (!usingPnpm()) {
  console.error('\nERROR: This repository requires pnpm. Please use pnpm to install dependencies.\n')
  console.error('To install pnpm: https://pnpm.io/installation\n')
  process.exit(1)
}
