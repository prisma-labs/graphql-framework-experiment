const boldWhite = '\u001b[37;1m'
const reset = '\u001b[0m'
const green = '\u001b[32;1m'
const purple = '\u001b[35;1m'
const CR = '\u001b[31;1m'
const blue = '\u001b[36;1m'
const yellow = '\u001b[33;1m'
const gray = '\u001b[30;1m'

let message = `
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   ${yellow}Nexus has become a framework!${reset}                             │
│   ${yellow}Nexus has become a framework!${reset}                             │
│   ${yellow}Nexus has become a framework!${reset}                             │
│                                                             │
│   Starting from 0.20.0 the nexus package is a framework.    │
│                                                             │
│   ${boldWhite}Learn more about the transition:${reset}	                      │
│   https://nxs.li/schema-to-framework/about                  │
│                                                             │
│   ${boldWhite}Learn more about the framework:${reset}                           │
│   https://nexusjs.org                                       │
│                                                             │
│   ${boldWhite}Migrate to the framework:${reset}                                 │
│   https://nxs.li/schema-to-framework/migrate                │
│                                                             │
│   ${boldWhite}Were you looking for the old Nexus?${reset}                       │
│   ${purple}@nexus/schema${reset}                                             │
│                                                             │
│                                                             │
│   ${gray}This post-install notice will be removed on July 1 2020${reset}   │
└─────────────────────────────────────────────────────────────┘

`

process.stdout.write(message)
