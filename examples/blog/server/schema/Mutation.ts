mutationType({
  definition(t) {
    t.string('a', () => 'foobar')
    // t.crud.createOneBlog()
    // t.crud.updateManyBlog()
  },
})
