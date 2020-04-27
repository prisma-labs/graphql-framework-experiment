const { generateArtifacts } = require('../dist/lib/build/artifact-generation')
const { create } = require('../dist/lib/layout')
const { rootLogger } = require('../dist/lib/nexus-logger')

async function main() {
  // Timeout after 10s to prevent from hanging process
  const timeoutId = setTimeout(() => {
    rootLogger.trace('10s timeout, exiting')
    process.exit(0)
  }, 10 * 1000)

  // cwd is __dirname by default in postinstall. Use INIT_CWD instead if available
  const cwd = process.env.INIT_CWD || process.cwd()
  const layout = await create({ cwd, throwInsteadOfExit: true })

  await generateArtifacts(layout)

  clearTimeout(timeoutId)
}

process.on("exit", () => {
  process.exitCode = 0;
});

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
