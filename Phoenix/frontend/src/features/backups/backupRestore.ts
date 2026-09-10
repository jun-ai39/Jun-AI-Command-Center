export function isRestoreConfirmationValid(
  filename: string | null,
  confirmation: string,
): boolean {
  return filename !== null && confirmation === filename
}
