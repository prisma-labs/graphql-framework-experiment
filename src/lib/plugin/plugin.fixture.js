export const correctTesttimePlugin = () => () => {
  return {
    foo: 'bar'
  }
}

export const wrongTesttimePlugin = () => () => {
  return []
}