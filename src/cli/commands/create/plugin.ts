/**
 * CLI command to help accelerate building a nexus plugin. The scaffolding is
 * based on the result that `$ tsdx init` produces.
 */
import { stripIndent } from 'common-tags'
import * as fs from 'fs-jetpack'
import prompts from 'prompts'
import { Command } from '../../../lib/cli'
import { createGitRepository, pog } from '../../../utils'
import { logger } from '../../../utils/logger'
import * as proc from '../../../utils/process'

const log = pog.sub('cli:create:plugin')

export default class Plugin implements Command {
  async parse() {
    logger.info('Scaffolding a nexus plugin')

    const pluginName = await askUserPluginName()
    const pluginPackageName = 'nexus-plugin-' + pluginName
    logger.info(`Creating directory ${pluginPackageName}...`)
    const projectPath = fs.path(pluginPackageName)
    await fs.dirAsync(projectPath)
    process.chdir(projectPath)

    logger.info(`Scaffolding files...`)
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
          dev: 'tsdx watch',
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
        babel: {
          plugins: [
            '@babel/plugin-proposal-optional-chaining',
            '@babel/plugin-proposal-nullish-coalescing-operator',
          ],
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
          paths: {
            '*': ['src/*', 'node_modules/*'],
          },
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

    logger.info(`Installing dev dependencies...`)
    await proc.run(
      'yarn add --dev ' +
        [
          '@babel/core',
          '@babel/plugin-proposal-nullish-coalescing-operator',
          '@babel/plugin-proposal-optional-chaining',
          '@types/jest',
          'husky',
          'nexus-future@latest',
          'tsdx',
          'tslib',
          'typescript',
          'doctoc',
        ].join(' ')
    )

    logger.info(`Initializing git repository...`)
    await createGitRepository()

    logger.info(stripIndent`
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
