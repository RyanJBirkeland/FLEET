import type { PartnerMessage, ChatChunk } from '../../../shared/types'

type MergeStrategy = 'squash' | 'merge' | 'rebase'

export async function getDiff(
  payload: Parameters<typeof window.api.review.getDiff>[0]
): ReturnType<typeof window.api.review.getDiff> {
  return window.api.review.getDiff(payload)
}

export async function getCommits(
  payload: Parameters<typeof window.api.review.getCommits>[0]
): ReturnType<typeof window.api.review.getCommits> {
  return window.api.review.getCommits(payload)
}

export async function getFileDiff(
  payload: Parameters<typeof window.api.review.getFileDiff>[0]
): ReturnType<typeof window.api.review.getFileDiff> {
  return window.api.review.getFileDiff(payload)
}

export async function shipIt(payload: {
  taskId: string
  strategy: MergeStrategy
}): ReturnType<typeof window.api.review.shipIt> {
  return window.api.review.shipIt(payload)
}

export async function shipBatch(payload: {
  taskIds: string[]
  strategy: MergeStrategy
}): ReturnType<typeof window.api.review.shipBatch> {
  return window.api.review.shipBatch(payload)
}

export async function mergeLocally(payload: {
  taskId: string
  strategy: MergeStrategy
}): ReturnType<typeof window.api.review.mergeLocally> {
  return window.api.review.mergeLocally(payload)
}

export async function createPr(payload: {
  taskId: string
  title: string
  body: string
}): ReturnType<typeof window.api.review.createPr> {
  return window.api.review.createPr(payload)
}

export async function requestRevision(payload: {
  taskId: string
  feedback: string
  mode: 'resume' | 'fresh'
  revisionFeedback?: unknown[]
}): ReturnType<typeof window.api.review.requestRevision> {
  return window.api.review.requestRevision(payload)
}

export async function rebase(payload: {
  taskId: string
}): ReturnType<typeof window.api.review.rebase> {
  return window.api.review.rebase(payload)
}

export async function checkFreshness(payload: {
  taskId: string
}): ReturnType<typeof window.api.review.checkFreshness> {
  return window.api.review.checkFreshness(payload)
}

export async function checkAutoReview(payload: {
  taskId: string
}): ReturnType<typeof window.api.review.checkAutoReview> {
  return window.api.review.checkAutoReview(payload)
}

export async function discard(payload: {
  taskId: string
}): ReturnType<typeof window.api.review.discard> {
  return window.api.review.discard(payload)
}

export async function markShippedOutsideFleet(payload: {
  taskId: string
}): ReturnType<typeof window.api.review.markShippedOutsideFleet> {
  return window.api.review.markShippedOutsideFleet(payload)
}

export async function approveTask(payload: {
  taskId: string
}): ReturnType<typeof window.api.review.approveTask> {
  return window.api.review.approveTask(payload)
}

export async function autoReview(
  taskId: string,
  force?: boolean
): ReturnType<typeof window.api.review.autoReview> {
  return window.api.review.autoReview(taskId, force)
}

export async function chatStream(params: {
  taskId: string
  messages: PartnerMessage[]
}): ReturnType<typeof window.api.review.chatStream> {
  return window.api.review.chatStream(params)
}

export async function abortChat(
  streamId: string
): ReturnType<typeof window.api.review.abortChat> {
  return window.api.review.abortChat(streamId)
}

export function onChatChunk(handler: (e: unknown, chunk: ChatChunk) => void): () => void {
  return window.api.review.onChatChunk(handler)
}
