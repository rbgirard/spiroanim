// src/services/query/types/SpiroAnimQSTypes.ts

export type ConfigRoot<AllVars extends string> = ['bits', number, AllVars[]] | ['move', number]

export type ConfigItem<AllVars extends string> =
  | ConfigRoot<AllVars>
  | ['anim', number, ConfigRoot<AllVars>[]]

export type ConfigData<AllVars extends string> =
  | [...ConfigRoot<AllVars>[]]
  | [...ConfigRoot<AllVars>[], ['anim', number, ConfigRoot<AllVars>[]]]

export type ConfigThird<AllVars extends string> = AllVars[] | ConfigRoot<AllVars>[] | undefined
