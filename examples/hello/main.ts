import { createApp } from 'pumpkins'

objectType({
  name: 'User',
  definition(t) {
    t.id('id')
    t.string('name')
  },
})

objectType({
  name: 'Query',
  definition(t) {
    t.list.field('users', {
      type: 'User',
      resolve() {
        return [{ id: '1643', name: 'newton' }]
      },
    })
  },
})

createApp().startServer()
