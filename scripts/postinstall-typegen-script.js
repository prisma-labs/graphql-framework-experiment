const { reflect } = require('../dist/lib/reflection')
const { create } = require('../dist/lib/layout')
const { rootLogger } = require('../dist/lib/nexus-logger')
const { detectExecLayout } = require('../dist/lib/process/detect-exec-layout')

/**
 * This script is purposedly designed to run as silently as possible, always exiting with a code 0
 * This is in order to prevent from blocking any workflow in postinstall hooks
 * Note that this script is run as a fork
 */
async function main() {
  // Timeout after 10s to prevent from hanging process
  const timeoutId = setTimeout(() => {
    rootLogger.trace('10s timeout, exiting')
    process.exit(0)
  }, 10 * 1000)

  const cwd = process.cwd()
  const execLayout = await detectExecLayout({ depName: 'nexus', cwd })

  // If the script was run from a global cli such as npx, don't run typegen
  if (!execLayout.toolProject) {
    process.exit(0)
  }

  // Otherwise, run typegen
  const layout = await create({ cwd })
  await reflect(layout, { artifacts: true })

  clearTimeout(timeoutId)
}

process.on('exit', () => {
  // Force exit code to be 0
  process.exitCode = 0
  rootLogger.trace('postinstall process exited')
})

// Catch all possible errors and only log them in trace level
process.on('uncaughtException', (error) => {
  rootLogger.trace('error in postinstall', { error })
  process.exit(0)
})

// Catch all possible unhandled rejectio and only log them in trace level
process.on('unhandledRejection', (error) => {
  rootLogger.trace('error in postinstall', { error })
  process.exit(0)
})

main()
