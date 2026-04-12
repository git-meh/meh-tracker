export function isSchemaOutOfDateError(error: unknown) {
  if (!(error instanceof Error)) {
    return false
  }

  const message = error.message.toLowerCase()
  return (
    message.includes('relation "') && message.includes('does not exist') ||
    message.includes('column "') && message.includes('does not exist')
  )
}
