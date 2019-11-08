// import { GraphQLServer } from 'graphql-yoga'
// import schema from './schema'
// import { createContext } from './context'

// const server = new GraphQLServer({
// schema,
// context: createContext(),
// })

import { createApp } from 'pumpkins'

createApp().startServer()

// import * as Nexus from 'nexus'
// import { nexusPrismaPlugin } from 'nexus-prisma'

// export default Nexus.makeSchema({
//   plugins: [nexusPrismaPlugin()],
//   typegenAutoConfig: {
//     contextType: 'Context.Context',
//     sources: [
//       {
//         source: '@generated/photon',
//         alias: 'photon',
//       },
//       {
//         source: require.resolve('../context'),
//         alias: 'Context',
//       },
//     ],
//   },
// })
