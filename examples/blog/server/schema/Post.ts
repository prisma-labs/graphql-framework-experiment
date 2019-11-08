objectType({
  name: 'CustomPost',
  definition(t) {
    t.string('a', () => 'foobar')
    // t.model('Post').id()
    // t.model('Post').title()
    // t.model('Post').tags()
    // t.model('Post').status()
  },
})
