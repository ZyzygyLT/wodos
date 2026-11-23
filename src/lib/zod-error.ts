export function formatZodError(error: { issues: Array<{ path: PropertyKey[]; message: string }> }) {
  const formErrors: string[] = []
  const fieldErrors: Record<string, string[]> = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.')
    if (key) {
      if (!fieldErrors[key]) fieldErrors[key] = []
      fieldErrors[key].push(issue.message)
    } else {
      formErrors.push(issue.message)
    }
  }
  return { formErrors, fieldErrors }
}
