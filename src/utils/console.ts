export function clearConsole() {
  /**
   * For convenience, we disable clearing the console when debugging
   */
  if (process.env.DEBUG !== undefined) {
    return
  }

  process.stdout.write('\x1Bc')
}
