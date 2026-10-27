/**
 * SKETCH: hand-typed copy of allauth's headless shapes (see allauth's shipped
 * openapi.yaml). Replaced by the generated `src/api/generated/auth` models once
 * the backend is configured and `make api-generate` runs.
 */
export type AuthUser = {
  id: number;
  display: string;
  email: string;
  has_usable_password: boolean;
};

export type AuthenticatedResponse = {
  status: 200;
  data: { user: AuthUser; methods: Array<{ method: "password"; at: number; email: string }> };
  meta: { is_authenticated: true };
};

export type UnauthenticatedResponse = {
  status: 401;
  data: { flows: Array<{ id: string }> };
  meta: { is_authenticated: false };
};

export type Credentials = { email: string; password: string };
