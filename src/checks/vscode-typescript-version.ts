import * as fs from 'fs-jetpack'
import { stripIndent } from 'common-tags'

const VSCODE_WORKSPACE_SETTINGS_FILE_PATH = fs.path('.vscode/settings.json')

export async function check(): Promise<void> {
  const maybeProblem = await await scanForProblem()

  if (maybeProblem?.kind === 'missing_file_or_not_set') {
    showMessageMissingFileOrNotSet()
  }
}

export function showMessageMissingFileOrNotSet(): void {
  console.log(stripIndent`
    If you are a VSCode user please make sure your editor TypeScript version is set to "Use Workspace version".
    Run the following VSCode command to bring up the selector:

      typescript: Select TypeScript Version...

    Learn more here:
    https://code.visualstudio.com/docs/typescript/typescript-compiling#_using-newer-typescript-versions
  `)
}

export async function scanForProblem(): Promise<null | {
  kind: 'missing_file_or_not_set'
}> {
  const expectedTypeScriptTSDKPath = 'node_modules/typescript/lib'
  const vsCodeSettings = await fs.readAsync(
    VSCODE_WORKSPACE_SETTINGS_FILE_PATH,
    'json'
  )

  if (vsCodeSettings?.['typescript.tsdk'] !== expectedTypeScriptTSDKPath) {
    return { kind: 'missing_file_or_not_set' }
  }

  return null
}
