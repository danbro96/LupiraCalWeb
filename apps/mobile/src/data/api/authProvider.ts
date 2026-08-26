/** The AuthPort inversion (ported from LupiraTasksMobile): data-layer code needs the live session but must not
 *  import state/ (upward). The auth store registers itself here at module load; the mutator reads through the
 *  port at call time so runtime backend switches take effect immediately. */

export interface AuthPort {
  getApiUrl(): string;
  /** null = no Authorization header (authMode 'none' — the Development BFF auto-authenticates). */
  getToken(): string | null;
  /** Rotation-safe refresh: force re-mints even if unexpired; sentToken lets a 401'd caller prove which token
   *  failed so an already-rotated session isn't rotated twice. Returns the current token (or null = signed out). */
  refresh(force?: boolean, sentToken?: string): Promise<string | null>;
  onSignIn(cb: () => void): () => void;
}

let port: AuthPort | null = null;

export function setAuthPort(p: AuthPort): void {
  port = p;
}

export function authPort(): AuthPort {
  if (!port) throw new Error('AuthPort not registered');
  return port;
}
