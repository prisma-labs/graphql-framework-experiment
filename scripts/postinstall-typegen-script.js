const { generateArtifacts } = require('../dist/lib/build/artifact-generation')
const { create } = require('../dist/lib/layout')
const { rootLogger } = require('../dist/lib/nexus-logger')
const { detectExecLayout } = require('../dist/lib/process/detect-exec-layout')

async function main() {
  // Timeout after 10s to prevent from hanging process
  const timeoutId = setTimeout(() => {
    rootLogger.trace('10s timeout, exiting')
    process.exit(0)
  }, 10 * 1000)

  // npm uses __dirname as CWD in a postinstall hook. We use INIT_CWD instead if available (set by npm)
  const cwd = process.env.INIT_CWD || process.cwd()
  const execLayout = await detectExecLayout({ depName: 'nexus', cwd })

  if (!execLayout.toolProject) {
    process.exit(0)
  }

  const layout = await create({ cwd })

  await generateArtifacts(layout)

  clearTimeout(timeoutId)
}

process.on('exit', () => {
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
