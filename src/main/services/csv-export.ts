/**
 * CSV export formatting for sprint tasks.
 * Extracted from sprint-local.ts to reduce coupling and improve cohesion.
 */

type TaskRecord = Record<string, unknown>

const CSV_HEADERS = [
  'id',
  'title',
  'repo',
  'status',
  'priority',
  'created_at',
  'updated_at',
  'started_at',
  'completed_at',
  'claimed_by',
  'spec',
  'prompt',
  'notes',
  'pr_url',
  'pr_number',
  'pr_status',
  'template_name',
  'playground_enabled',
  'depends_on',
  'tags'
] as const

/**
 * Escape a value for CSV output.
 * Handles special characters: comma, quote, newline.
 */
function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }

  let stringValue: string

  if (Array.isArray(value)) {
    stringValue = JSON.stringify(value)
  } else if (typeof value === 'boolean') {
    stringValue = value ? 'true' : 'false'
  } else {
    stringValue = String(value)
  }

  // Wrap in quotes if contains comma, quote, or newline
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`
  }

  return stringValue
}

/**
 * Convert an array of task records to CSV format.
 */
export function formatTasksAsCsv(tasks: TaskRecord[]): string {
  const csvRows: string[] = [CSV_HEADERS.join(',')]

  for (const task of tasks) {
    const row = CSV_HEADERS.map((header) => {
      const value = task[header]
      return escapeCsvValue(value)
    })
    csvRows.push(row.join(','))
  }

  return csvRows.join('\n')
}
