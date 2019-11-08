objectType({
  name: 'User',
  definition(t) {
    t.string('a', () => 'foobar')
    // t.model.id()
    // t.model.name()
    // t.model.blog()
    // t.model.posts({ type: 'CustomPost' })
    // t.model.role()
  },
})
