import * as tsd from 'tsd'
import { KeepRequiredKeys } from '../utils'
import * as s from './'

/**
 * field
 */

// if data optional THEN field spec not required
s.create<{ a?: number}, { a?: number }>({ spec: {}})
// ... but permitted
s.create<{ a?: number}, { a?: number }>({ spec: { a: {} }})


/**
 * field initializer
 */

// if input field optional THEN initializer required and must return the same type as the input field (sans void)
s.create<{ a?: boolean }, { a: number }>({ spec: { a: { initial: () => true,  mapType: (a) => 1 } } })
// @ts-expect-error
s.create<{ a?: boolean }>({ spec: { a: { mapType: (a) => 1 } } })
// @ts-expect-error
s.create<{ a?: boolean }, { a: number }>({ spec: { a: { initial: () => 1, mapType: (a) => 1 } } })

// if input field required THEN initializer forbidden
s.create<{ a: number }>({ spec: { a: {} } })
// @ts-expect-error
s.create<{ a: number }>({ spec: { a: { initial: () => 'adfdsf' } } })

// if data is optional then initializer may return undefined
s.create<{ a?: number }, { a?:number }>({ spec: { a: {} } })
// ...but it is still allowed if desired
s.create<{ a?: number }, { a?:number }>({ spec: { a: { initial: () => 1 } } })
// ...and if given may also return undefined
s.create<{ a?: number }, { a?:number }>({ spec: { a: { initial: () => undefined } } })


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
 * validate & fixup
 */

// validate gets non-optional input  
s.create<{ a?: number }>({ spec: { a: { initial: () => 1, validate: (a) => { const b: number = a ; return null } } } })
// fixup gets non-optional input  
s.create<{ a?: number }>({ spec: { a: { initial: () => 1, fixup: (a) => { const b: number = a; return null} } } })

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
 * raw
 */

// todo raw breaks type errors badly, so disabled for now.
// todo it is a union alternative, object with raw method
// todo problem is certain type errors in main union member
//      lead to only suggesting/talking about this raw alt
// s.create<{ a: number }>({ spec: { raw: (input) => input } })
// s.create<{ a: number }>({ spec: { a: { raw: (a) => a } } })
// s.create<{ a: Record<string, {z: number }> }>({ spec: { a: { raw(input) { return input } } }})

/**
 * Records
 */

// by default entry fields are required to be listed in entryFields
s.create<{ a: Record<string, {z: number }> }>({ spec: { a: { entryFields: { z: {} } } }})
// @ts-expect-error
s.create<{ a: Record<string, {z: number }> }>({ spec: { a: { entryFields: {} } }})
// @ts-expect-error
s.create<{ a: Record<string, {z: number }> }>({ spec: { a: {} }})
// @ts-expect-error
s.create<{ a: Record<string, {z?: number }> }>({ spec: { a: { entryFields: {} } }})

// if entry data field is optional, then so to is entry input field spec
// ... optionality of input does not matter then
s.create<{ a: Record<string, {z: number }> }, { a: Record<string, {z?: number }> }>({ spec: { a: { entryFields: {} } }})
s.create<{ a: Record<string, {z?: number }> }, { a: Record<string, {z?: number }> }>({ spec: { a: { entryFields: {} } }})
// ... input field spec may still be provided if desired
s.create<{ a: Record<string, {z: number }> }, { a: Record<string, {z?: number }> }>({ spec: { a: { entryFields: { z: {} } } }})
// ... if all entry input field specs are optional then so to is entryFields property itself
// todo
// s.create<{ a: Record<string, {z: number }> }, { a: Record<string, {z?: number }> }>({ spec: { a: {} }})
// ... ... but still permitted 
s.create<{ a: Record<string, {z: number }> }, { a: Record<string, {z?: number }> }>({ spec: { a: { entryFields: {} } }})

// if entry input field optional THEN initializer required
s.create<{ a: Record<string, {z?: number }> }>({ spec: { a: { entryFields: { z: { initial: () => 1 } } } }})
// @ts-expect-error
s.create<{ a: Record<string, {z?: number }> }>({ spec: { a: { entryFields: { z: {} } } }})

// if input field optional THEN initializer required
s.create<{ a?: Record<string, {z: number }> }>({ spec: { a: { entryFields: { z: {} }, initial: () => ({foo:{z:1}}) } }})
// @ts-ignore-error
s.create<{ a?: Record<string, {z: number }> }>({ spec: { a: { entryFields: { z: {} } }}})
// ... but if entry input fields all optional THEN initializer optional
s.create<{ a?: Record<string, {z?: number }> }>({ spec: { a: { entryFields: { z: {initial: () => 1 } }  } }})
s.create<{ a?: Record<string, {z?: number }> }>({ spec: { a: { entryFields: { z: {initial: () => 1 } }, initial: () => ({foo:{z:1}}) } }})
// REGRESSION TEST: initial must return an empety record or record of valid entries
// @ts-expect-error
s.create<{ a?: Record<string, {z?: number }> }>({ spec: { a: { entryFields: { z: {initial: () => 1 } }, initial: () => ({foo:{z:true}}) } }})

// // todo
// // if entry input/data field types are mismatch THEN entry input field spec mapType required
// // todo this also triggers requiring mapEntryData ... developer should be able to choose which they want ... not able to provide both ... either top level or all sub-instances
// // ... actually looking below, for shadow data fields, local mappers are a really bad fit, not just a style difference
// s.create<{ a: Record<string, {z: number }> },  { a: Record<string, { z: boolean }> }>({ spec: { a: { entryFields: { z: { mapType: Boolean } }, } }})
// @ts-ignore-error
s.create<{ a: Record<string, {z: number }> },  { a: Record<string, { z: boolean }> }>({ spec: { a: { entryFields: { z: {} } } }})

// // todo
// // if entry input/data field are mismatch THEN entry input field spec mapData required
// s.create<{ a: Record<string, {z: number }> },  { a: Record<string, { y: number }> }>({ spec: { a: { entryFields: { z: { mapData: (z) => ({y:z})} } } }})

// if data has fields that are not present in input THEN mapEntryData is required 
s.create<{ a: Record<string, {a: number }> },  { a: Record<string, { a: number, b: number }> }>({ spec: { a: { entryFields: { a: {} }, mapEntryData: (input) => ({ ...input, b:1 }) } }})
// @ts-expect-error
s.create<{ a: Record<string, {a: number }> },  { a: Record<string, { a: number, b: number }> }>({ spec: { a: { entryFields: { a: {} } } }})

// if non-pojo unioned with input entry pojo THEN input entry field spec shorthand required
s.create<{ a: Record<string, number | {a: number }> }>({ spec: { a: { entryFields: { a: {} }, entryShorthand: (a) => ({a}) } }})
// @ts-expect-error
s.create<{ a: Record<string, number | {a: number }> }>({ spec: { a: { entryFields: { a: {} } } }})

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
s.create<{ a?: { a?: number } }>({ spec: { a: { fields:{ a: { initial: () => 1 } } } } })

// RegExp does not get counted as namesapce
s.create<{ a?: { b?: string | RegExp } }>({ spec: { a: { fields: { b: { initial: () => /a/ } } } } })
// Date does not get counted as namesapce
s.create<{ a?: { b?: string | Date } }>({ spec: { a: { fields: { b: { initial: () => new Date() } } } } })

// works with interfaces
interface A { a?: number }
s.create<{ a?: A }>({ spec: { a: { fields:{ a: { initial: () => 1 } } } } })
s.create<{ a?: 1 | A }>({ spec: { a: { shorthand: () => ({a:1}), fields:{ a: { initial: () => 1 } } } } })

/**
 * DataDefault
 */

const dataDefualt1: s.DataDefault<{}> = {}
const dataDefualt2: s.DataDefault<{ a: 1 }>               = { a: 1 }
const dataDefualt3: s.DataDefault<{ a: { a: 1 } }>        = { a: { a: 1 } }
const dataDefualt4: s.DataDefault<{ a: 1 | { a: 1 } }>    = { a: { a: 1 } }
tsd.expectType<{a: { a: number }}>({} as s.DataDefault<{ a: 1 | A }>)

// optionality
const dataDefualt1b: s.DataDefault<{ a?: 1 }>             = { a: 1 }
// @ts-expect-error
const dataDefualt1c: s.DataDefault<{ a?: 1 }>             = { a: undefined }

/**
 * helpers
 */

// KeepRequiredKeys
tsd.expectType<{a: 1}>({} as KeepRequiredKeys<{ a: 1; b?: 2 }>)
// @ts-expect-error
tsd.expectError<{a: 1}>({b:2} as KeepRequiredKeys<{ a: 1; b?: 2 }>)
