objectType({
  name: 'User',
  definition(t) {
    t.model.id()
    t.model.name()
  },
})

objectType({
  name: 'Query',
  definition(t) {
    t.list.field('users', {
      type: 'User',
      resolve(_root, _args, _ctx) {
        return [{ id: 1643, name: 'newton' }]
      },
    })
  },
})
