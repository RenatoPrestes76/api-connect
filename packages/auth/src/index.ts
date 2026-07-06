/**
 * @seltriva/auth
 * Authentication and authorization layer (Supabase)
 */

// Placeholder for Supabase Auth integration
export interface AuthUser {
  id: string;
  email: string;
  emailConfirmedAt?: Date;
}

export interface AuthSession {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

// TODO: Implement Supabase integration
// export async function signUp(email: string, password: string): Promise<AuthSession> {
//   // Implementation
// }

// export async function signIn(email: string, password: string): Promise<AuthSession> {
//   // Implementation
// }

// export async function signOut(): Promise<void> {
//   // Implementation
// }
