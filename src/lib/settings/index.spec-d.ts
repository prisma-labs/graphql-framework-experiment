import * as s from './'

/**
 * field initializer
 */

// if input field optional then initializer required and must return the same type as the input field (sans void)
s.create<{ a?: boolean }, { a: number }>({ spec: { a: { initial: () => true,  mapType: (a) => 1 } } })
// @ts-expect-error
s.create<{ a?: boolean }>({ spec: { a: { mapType: (a) => 1 } } })
// @ts-expect-error
s.create<{ a?: boolean }, { a: number }>({ spec: { a: { initial: () => 1, mapType: (a) => 1 } } })

// if input field required then initializer forbidden
s.create<{ a: number }>({ spec: { a: {} } })
// @ts-expect-error
s.create<{ a: number }>({ spec: { a: { initial: () => 1 } } })

/**
 * mapType
 */

// if input/data types differ then mapType requried
s.create<{ a: boolean }, { a: number }>({ spec: { a: { mapType: (a) => 1 } } })
// @ts-expect-error
s.create<{ a: boolean }, { a: number }>({ spec: { a: {} } })

// if input/data types same then mapType forbidden
s.create<{ a: number }>({ spec: { a: {} } })
// @ts-expect-error
s.create<{ a: number }>({ spec: { a: { mapType: (a) => 1 } } })

/**
 * mapData
 */

// if input field key not present in data field keys then mapData required
s.create<{ a: number }, { b: number }>({ spec: { a: { mapData: (a) => ({ b: a }) } } })
// @ts-expect-error
s.create<{ a: numebr }, { b: number }>({ spec: { a: {} } })

// if input field key is present in data field keys then mapData forbidden
s.create<{ a: number }, { a: number }>({ spec: { a: {} } })
// @ts-expect-error
s.create<{ a: number }, { a: number }>({ spec: { a: { mapData: (a) => ({ b: a }) } } })


/**
 * default data type
 */

// by default data type is non-void input type
// notice no mapTypes needed here
s.create<{ a?: number }>({ spec: { a: { initial: () => 1 } } })
s.create<{ a: number }>({ spec: { a: {} } })

/**
 * raw
 */

s.create<{ a: number }>({ spec: { raw: (input) => input } })
s.create<{ a: number }>({ spec: { a: { raw: (a) => a } } })
s.create<{ a: Record<string, {z: number }> }>({ spec: { a: { raw(input) { return input } } }})

/**
 * indexed types
 */

s.create<{ a: Record<string, {z: number }> },  { a: Record<string, { z: number }> }>({ spec: { a: { entryFields: { z: {} } } }})
s.create<{ a?: Record<string, {z: number }> },  { a: Record<string, { z: number }> }>({ spec: { a: { entryFields: { z: {} }, initial: () => ({foo:{z:1}}) } }})
s.create<{ a?: Record<string, {z?: number }> },  { a: Record<string, { z: number }> }>({ spec: { a: { entryFields: { z: {} }, initial: () => ({foo:{z:1}}) } }})

s.create<{ a: Record<string, {z: number }> }>({ spec: { a: { entryFields: { z: {} } } }})

// @ts-ignore-error
s.create<{ a: Record<string, {z?: number }> },  { a: Record<string, { z: number }> }>({ spec: { a: { entryFields: { z: {} } } }})
// @ts-ignore-error
s.create<{ a: Record<string, {z: number }> },  { a: Record<string, { z: boolean }> }>({ spec: { a: { entryFields: { z: {} } } }})
// @ts-ignore-error
s.create<{ a: Record<string, {z: number }> },  { a: Record<string, { y: number }> }>({ spec: { a: { entryFields: { z: {} } } }})

/**
 * namespaced types
 */

s.create<{ a: { a: number } }>({ spec: { a: { fields:{ a: {} } } } })
s.create<{ a: { a: number } }, { a: { z: number }}>({ spec: { a: { fields:{ a: { mapData: (a) => ({ z: a }) } } } } })
s.create<{ a: { a: number } }, { a: { a: boolean }}>({ spec: { a: { fields:{ a: { mapType: (a) => Boolean(a) } } } } })

// if an input type is union with non-pojo type then shorthand required 
s.create<{ a: number | { a: number } }>({ spec: { a: { shorthand: (a) => ({ a }), fields:{ a: {} } } } })
//@ts-expect-error
s.create<{ a: number | { a: number } }>({ spec: { a: { fields:{ a: {} } } } })

// if an input field type is optional AND 1+ sub input fields are required THEN initial is required 
s.create<{ a?: { a: number } }>({ spec: { a: { initial: () => ({a:1}),  fields:{ a: {} } } } })
// @ts-ignore-error
s.create<{ a?: { a: number } }>({ spec: { a: { shorthand: (a) => ({ a }), fields:{ a: {} } } } })
// ... but if data says field can be undefined too THEN initial is forbidden
s.create<{ a?: { a: number } }, { a?: { a: number } }>({ spec: { a: { fields:{ a: {} } } } })
// ... but if 0 sub input fields are required THEN initial is forbidden (b/c we can automate the initial)
s.create<{ a?: { a?: number } }>({ spec: { a: { fields:{ a: {initial: () => 1 } } } } })

/**
 * DataDefault
 */

const dataDefualt1: s.DataDefault<{}> = {}
const dataDefualt2: s.DataDefault<{ a: 1 }>               = { a: 1 }
const dataDefualt3: s.DataDefault<{ a: { a: 1 } }>        = { a: { a: 1 } }
const dataDefualt4: s.DataDefault<{ a: 1 | { a: 1 } }>    = { a: { a: 1 } }

// optionality
const dataDefualt1b: s.DataDefault<{ a?: 1 }>             = { a: 1 }
//@ts-expect-error
const dataDefualt1c: s.DataDefault<{ a?: 1 }>             = { a: undefined }
