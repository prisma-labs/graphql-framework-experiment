const boldWhite = '\u001b[37;1m'
const reset = '\u001b[0m'
const green = '\u001b[32;1m'
const purple = '\u001b[35;1m'
const CR = '\u001b[31;1m'
const blue = '\u001b[36;1m'
const red = '\u001b[1;31m'
const yellow = '\u001b[33;1m'
const gray = '\u001b[30;1m'

const path = require('path')

/**
 * data
 */

const bundledDeps = ['graphql', '@nexus/schema']

/**
 * Helpers
 */

function getPackageManagerBinName() {
  const userAgent = process.env.npm_config_user_agent || ''

  const packageManagerBinName = userAgent.includes('yarn') ? 'yarn' : 'npm'
  return packageManagerBinName
}

function getPackageJson() {
  let data = {}
  try {
    data = require(path.join(process.cwd(), 'package.json'))
  } catch (error) {
    // ignore
  }

  if (typeof data !== 'object') {
    // invalid package json like null
    // force object for downstream property access
    data = {}
  }

  return data
}

function findDepsDeDuped(pj, bundledDeps) {
  const foundDeps = []

  const deps = pj.dependencies || []
  foundDeps.push(...Object.keys(deps).filter(isBundledDep))

  const devDeps = pj.devDependencies || []
  foundDeps.push(
    ...Object.keys(devDeps)
      .filter(isBundledDep)
      // dedupe
      .filter((name) => !foundDeps.includes(name))
  )

  return foundDeps

  function isBundledDep(name) {
    return bundledDeps.includes(name)
  }
}

/**
 * script
 */

let foundDeps = findDepsDeDuped(getPackageJson(), bundledDeps)

const message = `
${red}│${reset}  ${red}WARNING${reset} from ${boldWhite}nexus${reset}
${red}│${reset}  ${red}WARNING${reset} from ${boldWhite}nexus${reset}
${red}│${reset}  ${red}WARNING${reset} from ${boldWhite}nexus${reset}
${red}│${reset} 
${red}│${reset}  ${yellow}nexus${reset} bundles ${yellow}graphql${reset} and ${yellow}@nexus/schema${reset} dependencies.
${red}│${reset}  So please uninstall the ones you have installed or you
${red}│${reset}  may encounter problems.
${red}│${reset}  
${red}│${reset}  Run the following commands to fix this issue
${red}│${reset}
${red}│${reset}    1. Remove the deps:
${red}│${reset} 
${red}│${reset}       ${green}${getPackageManagerBinName()} remove ${foundDeps.join(' ')}${reset}
${red}│${reset}
${red}│${reset}    2. (Precaution) Reset the node_modules:
${red}│${reset}
${red}│${reset}       ${green}rm -rf node_modules${reset}
${red}│${reset}       ${green}${getPackageManagerBinName()} install${reset}
${red}│${reset} 
${red}│${reset}  If you absolutely need to control the versions of these
${red}│${reset}  dependencies then use Yarn and its ${yellow}resolutions${reset} feature:
${red}│${reset} 
${red}│${reset}  ${boldWhite}https://classic.yarnpkg.com/en/docs/selective-version-resolutions${reset}
${red}│${reset} 
${red}│${reset}  If you are curious why ${yellow}nexus${reset} bundles these dependencies
${red}│${reset}  then refer to the Nexus doc explaining this strategy.
${red}│${reset} 
${red}│${reset}  ${boldWhite}https://nxs.li/why/bundle-dependencies${reset}
`

if (foundDeps.length > 0) {
  console.log(message)
}
