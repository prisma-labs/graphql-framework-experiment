# `import { use }`

[issues](https://github.com/graphql-nexus/nexus/issues?q=is%3Aissue+is%3Aopen+sort%3Aupdated-desc+label%3Ascope%2Fplugins) – [features](https://github.com/graphql-nexus/nexus/issues?q=is%3Aissue+is%3Aopen+sort%3Aupdated-desc+label%3Ascope%2Fplugins+label%3Atype%2Ffeat) ⬝ [bugs](https://github.com/graphql-nexus/nexus/issues?q=is%3Aissue+is%3Aopen+sort%3Aupdated-desc+label%3Ascope%2Fplugins+label%3Atype%2Fbug)

Use the plugin component to add new functionality to your project.

##### Signature

```ts
(nexusPlugin: NexusPlugin) => void
```

##### Example

```ts
import { use } from 'nexus'
import { prisma } from 'nexus-plugin-prisma'

use(prisma())
```

##### Remarks

To discover plugins, simply look to the sidebar listing on this website.

To get an overview of what Nexus plugin _are_ refer to the [Plugins guide](/guides/plugins).

To learn how to write your own plugins refer to the [Writing Plugins guide](/guides/writing-plugins).
