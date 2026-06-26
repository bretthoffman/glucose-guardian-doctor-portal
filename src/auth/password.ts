/**
 * Client-side password hash — must match the backend / mobile app exactly
 * (artifacts/mobile/context/AuthContext.tsx `hashPassword`). The server only ever
 * receives this hash, never the raw password.
 */
export function hashPassword(password: string): string {
  const salted = `gg::${password}::glucose_guardian_2025`;
  let encoded = "";
  for (let i = 0; i < salted.length; i++) {
    encoded += salted.charCodeAt(i).toString(16).padStart(2, "0");
  }
  return encoded;
}
