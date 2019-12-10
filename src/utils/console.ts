export function clearConsole() {
  process.stdout.write('\x1Bc')
}
