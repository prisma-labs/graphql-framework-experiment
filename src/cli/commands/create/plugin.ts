/**
 * CLI command to help accelerate building a nexus plugin. The scaffolding is
 * based on the result that `$ tsdx init` produces.
 */
import { stripIndent } from 'common-tags'
import * as fs from 'fs-jetpack'
import prompts from 'prompts'
import { Command } from '../../../lib/cli'
import { rootLogger } from '../../../lib/nexus-logger'
import * as proc from '../../../lib/process'
import { createGitRepository } from '../../../lib/utils'

const log = rootLogger
  .child('cli')
  .child('create')
  .child('plugin')

export default class Plugin implements Command {
  async parse() {
    log.info('Scaffolding a nexus plugin')

    const pluginName = await askUserPluginName()
    const pluginPackageName = 'nexus-plugin-' + pluginName
    log.info(`Creating directory ${pluginPackageName}...`)
    const projectPath = fs.path(pluginPackageName)
    await fs.dirAsync(projectPath)
    process.chdir(projectPath)

    log.info(`Scaffolding files...`)
    await Promise.all([
      fs.writeAsync(
        'README.md',
        stripIndent`
          # ${pluginPackageName} <!-- omit in toc -->

          **Contents**

          <!-- START doctoc generated TOC please keep comment here to allow auto update -->
          <!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
          <!-- END doctoc generated TOC please keep comment here to allow auto update -->

          <br>

          ## Installation


          \`\`\`
          npm install ${pluginPackageName}
          \`\`\`

          <br>

          ## Example Usage

          TODO

          <br>

          ## CLI Contributions

          TODO

          <br>

          ## API Contributions

          TODO
        `
      ),
      fs.writeAsync('package.json', {
        name: pluginPackageName,
        version: '0.0.0',
        license: 'MIT',
        main: 'dist/index.js',
        module: `dist/${pluginPackageName}.esm.js`,
        typings: 'dist/index.d.ts',
        files: ['dist'],
        scripts: {
          dev: 'tsdx watch --entry src/index.ts',
          'build:doc': 'doctoc README.md --notitle',
          'build:ts': 'tsdx build',
          build: 'yarn -s build:ts && yarn -s build:doc',
          test: 'tsdx test',
          lint: 'tsdx lint',
          'publish:next':
            '[ "$(git rev-parse --abbrev-ref HEAD)" = "master" ] && yarn publish --tag next --no-git-tag-version --new-version "0.0.0-next.$(git show -s head --format=\'%h\')" && git commit -am \'chore: version\' && git push',
          'publish:pr':
            "PR=$(hub pr show -f '%I') && yarn publish --tag pr.${PR} --no-git-tag-version --new-version \"0.0.0-pr.${PR}.$(git show -s head --format='%h')\" && git commit -am 'chore: version' && git push ",
          prepack: 'yarn -s build',
        },
        peerDependencies: {
          'nexus-future': 'latest',
        },
        husky: {
          hooks: {
            'pre-commit': 'tsdx lint',
          },
        },
        prettier: {
          semi: false,
          singleQuote: true,
          trailingComma: 'es5',
        },
      }),
      fs.writeAsync('tsconfig.json', {
        include: ['src', 'types', 'test'],
        compilerOptions: {
          target: 'es5',
          module: 'esnext',
          lib: ['esnext'],
          importHelpers: true,
          declaration: true,
          sourceMap: true,
          rootDir: './',
          strict: true,
          noImplicitReturns: true,
          noFallthroughCasesInSwitch: true,
          moduleResolution: 'node',
          baseUrl: './',
          esModuleInterop: true,
        },
      }),
      fs.writeAsync(
        '.gitignore',
        stripIndent`
          *.log
          .DS_Store
          node_modules
          .rts2_cache_cjs
          .rts2_cache_esm
          .rts2_cache_umd
          .rts2_cache_system
          dist
          .vscode
        `
      ),
      fs.writeAsync(
        'src/index.ts',
        stripIndent`
          import * as NexusPlugin from 'nexus-future/plugin'

          export const create = NexusPlugin.create(nexusFuture => {
            nexusFuture.workflow((hooks, _context) => {
              hooks.build.onStart = async () => {
                nexusFuture.utils.log.info('Hello from ${pluginName}!')
              }
            })

            nexusFuture.runtime(() => {
              return {
                context: {
                  create: _req => {
                    return {
                      '${pluginPackageName}': 'hello world!'
                    }
                  },
                  typeGen: {
                    fields: {
                      '${pluginPackageName}': 'string'
                    }
                  }
                }
              }
            })
          })
        `
      ),
    ])

    log.info(`Installing dev dependencies...`)
    await proc.run(
      'yarn add --dev ' +
        [
          '@types/jest',
          'husky',
          'nexus-future@latest',
          'tsdx',
          'tslib',
          'typescript',
          'doctoc',
        ].join(' ')
    )

    log.info(`Initializing git repository...`)
    await createGitRepository()

    log.info(stripIndent`
        Done! To get started:

               cd ${pluginPackageName} && yarn dev
    `)
  }
}

/**
 * Promp the user to give the plugin they are about to work on a name.
 */
async function askUserPluginName(): Promise<string> {
  // TODO prompt with "nexus-plugin-" text faded gray e.g.
  //
  // > nexus-plugin-|
  //
  //
  // TODO check the npm registry to see if the name is already taken before
  // continuing.
  //
  const { pluginName }: { pluginName: string } = await prompts({
    type: 'text',
    name: 'pluginName',
    message: 'What is the name of your plugin?',
  })
  const pluginNameNormalized = pluginName.replace(/^nexus-plugin-(.+)/, '$1')
  return pluginNameNormalized
}
