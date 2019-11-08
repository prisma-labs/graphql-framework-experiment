objectType({
  name: 'Blog',
  definition(t) {
    t.string('a', () => 'foobar')
    // t.model.id()
    // t.model.name()
    // t.model.createdAt()
    // t.model.updatedAt()
    // t.model.posts({
    //   type: 'CustomPost',
    //   pagination: false,
    //   ordering: true,
    //   filtering: { title: true },
    // })
    // t.model.viewCount()
    // t.model.authors()
  },
})
