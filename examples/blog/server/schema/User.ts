objectType({
  name: 'User',
  definition(t) {
    t.model.id()
    t.model.name()
    t.model.blog()
    t.model.posts({ type: 'CustomPost' })
    t.model.role()
  },
})
