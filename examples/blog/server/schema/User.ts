objectType({
  name: 'User',
  definition(t) {
    t.model.id()
    t.model.name()
    t.model.blog()
    t.model.posts({ type: 'CustomPost' })
    t.model.role()
    t.boolean('isLongName', user => {
      return user.name !== null ? user.name.length > 5 : false
    })
  },
})
