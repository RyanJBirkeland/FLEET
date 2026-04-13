import type { ParsedSpec, SpecIssue } from './types'

/** Parses raw markdown spec string into structured form */
export interface ISpecParser {
  parse(raw: string): ParsedSpec
}

/** Synchronous, pure validator — no I/O, no async */
export interface ISpecValidator {
  validate(spec: ParsedSpec): SpecIssue[]
}

/** Async validator — may call AI or external service */
export interface IAsyncSpecValidator {
  validate(spec: ParsedSpec): Promise<SpecIssue[]>
}
