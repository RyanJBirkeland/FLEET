import { typedInvoke } from './ipc-helpers'

export const listMemoryFiles = () => typedInvoke('memory:listFiles')

export const readMemoryFile = (path: string) => typedInvoke('memory:readFile', path)

export const writeMemoryFile = (path: string, content: string) =>
  typedInvoke('memory:writeFile', path, content)

export const searchMemory = (query: string) => typedInvoke('memory:search', query)

export const getActiveMemoryFiles = () => typedInvoke('memory:getActiveFiles')

export const setMemoryFileActive = (path: string, active: boolean) =>
  typedInvoke('memory:setFileActive', path, active)
