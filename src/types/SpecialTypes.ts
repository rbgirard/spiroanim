// src/types/SpecialTypes.ts

// ChatGPT failed me miserably when trying to get Indices from a Tuple, then found this:
// https://stackoverflow.com/questions/59184570/get-index-type-of-an-array-literal/63904714#63904714

/** Type of the elements in an array */
export type ElementOf<T> = T extends readonly (infer E)[] ? E : never

/** Elements of an array after the first. */
export type Tail<T extends unknown[] | readonly unknown[]> = T extends readonly [
  unknown,
  ...infer Rest,
]
  ? Rest
  : []

/** Used internally for `IndicesOf`; probably useless outside of that. */
//type AsDescendingLengths<T extends unknown[] | readonly unknown[]> =
//  [] extends T ? [0] :
//  [ElementOf<ElementOf<AsDescendingLengths<Tail<T>>[]>>, T['length']]

/** Union of numerical literals corresponding to a tuple's possible indices */
//export type IndicesOf<T extends unknown[] | readonly unknown[]> =
//  number extends T['length'] ? number :
//  [] extends T ? never :
//  ElementOf<AsDescendingLengths<Tail<T>>>

// And the simpler version
// https://stackoverflow.com/questions/66786088/how-to-create-a-union-type-of-indexes-of-a-constant-array-with-typescript
/** Given a const array, return the union of all its numeric indices */
export type IndicesOf<T extends readonly unknown[]> = Exclude<
  Partial<T>['length'], // the union of all array lengths up to the length of the T array
  T['length'] // except the last, which is not indexable because the final index is n-1
>
