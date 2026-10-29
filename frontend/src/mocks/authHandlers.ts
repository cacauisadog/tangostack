import { delay, http, HttpResponse } from "msw";
import type {
  AuthenticatedResponse,
  AuthenticationResponse,
  ConflictResponse,
  ErrorResponse,
  ErrorResponseErrorsItem,
} from "#/api/generated-auth";
import type { ProviderFlow } from "#/auth/api";
import { db, type MockUser } from "./db";

// allauth-shaped bodies (its own envelope, not Ninja's). Keep in sync with allauth's spec.
const BASE = "*/_allauth/browser/v1/auth";
const GOOGLE_EMAIL = "vanilda@gmail.com";

// There's no inbox in mock mode, so the emailed keys are predictable: open
// /auth/verify-email/verify-<email> or /auth/reset-password/reset-<email> by hand.
const emailFromKey = (kind: "verify" | "reset", key: string | null) =>
  key?.startsWith(`${kind}-`) ? key.slice(kind.length + 1) : undefined;

const flows: ProviderFlow[] = [
  { id: "login" },
  { id: "signup" },
  { id: "provider_redirect", providers: ["google"] },
];

const unauthenticatedBody = (): AuthenticationResponse => ({
  status: 401,
  data: { flows },
  meta: { is_authenticated: false },
});

/** What allauth answers while an address still has to be confirmed (the link was emailed). */
const verificationPendingBody = (): AuthenticationResponse => ({
  status: 401,
  data: { flows: [...flows, { id: "verify_email", is_pending: true }] },
  meta: { is_authenticated: false },
});

const authenticatedBody = (user: MockUser): AuthenticatedResponse => ({
  status: 200,
  data: {
    user: {
      id: user.id,
      display: user.display,
      email: user.email,
      has_usable_password: user.has_usable_password,
    },
    methods: [{ method: "password", at: Date.now() / 1000, email: user.email }],
  },
  meta: { is_authenticated: true },
});

const badRequest = (...errors: ErrorResponseErrorsItem[]) =>
  HttpResponse.json<ErrorResponse>({ status: 400, errors }, { status: 400 });

const required = (param: string) => ({
  message: "This field is required.",
  code: "required",
  param,
});

/** The password rules Django's default validators enforce (the ones worth mocking). */
function passwordProblems(password: string) {
  const errors: ErrorResponseErrorsItem[] = [];
  if (password.length < 8) {
    errors.push({
      message: "This password is too short. It must contain at least 8 characters.",
      code: "password_too_short",
      param: "password",
    });
  }
  if (/^\d+$/.test(password)) {
    errors.push({
      message: "This password is entirely numeric.",
      code: "password_entirely_numeric",
      param: "password",
    });
  }
  return errors;
}

export const authHandlers = [
  http.get(`${BASE}/session`, async () => {
    await delay();
    const user = db.currentUser();
    return user
      ? HttpResponse.json(authenticatedBody(user))
      : HttpResponse.json(unauthenticatedBody(), { status: 401 });
  }),

  http.post<never, { email?: string; password?: string }>(`${BASE}/login`, async ({ request }) => {
    await delay();
    if (db.currentUser()) {
      return HttpResponse.json<ConflictResponse>({ status: 409 }, { status: 409 });
    }
    const { email, password } = await request.json();
    if (!email) return badRequest(required("email"));
    if (!password) return badRequest(required("password"));
    const user = db.findUserByEmail(email);
    if (!user || user.password !== password) {
      return badRequest({
        message: "The email address and/or password you specified are not correct.",
        code: "email_password_mismatch",
        param: "password",
      });
    }
    if (!user.verified) {
      return HttpResponse.json(verificationPendingBody(), { status: 401 });
    }
    db.signIn(user);
    return HttpResponse.json(authenticatedBody(user));
  }),

  http.post<never, { email?: string; password?: string }>(`${BASE}/signup`, async ({ request }) => {
    await delay();
    if (db.currentUser()) {
      return HttpResponse.json<ConflictResponse>({ status: 409 }, { status: 409 });
    }
    const { email, password } = await request.json();
    const errors: ErrorResponseErrorsItem[] = [];
    if (!email) errors.push(required("email"));
    else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      errors.push({ message: "Enter a valid email address.", code: "invalid", param: "email" });
    }
    if (!password) errors.push(required("password"));
    else errors.push(...passwordProblems(password));
    if (errors.length) return badRequest(...errors);

    // Like allauth with enumeration prevention: an existing address gets the same
    // answer as a new one (its owner is told by email instead). Nobody is signed in
    // until the emailed link is opened.
    if (!db.findUserByEmail(email!)) db.addUser(email!, password!, { verified: false });
    return HttpResponse.json(verificationPendingBody(), { status: 401 });
  }),

  http.get(`${BASE}/email/verify`, async ({ request }) => {
    await delay();
    const email = emailFromKey("verify", request.headers.get("X-Email-Verification-Key"));
    const user = email ? db.findUserByEmail(email) : undefined;
    if (!user)
      return badRequest({ message: "Invalid or expired key.", code: "invalid", param: "key" });
    return HttpResponse.json({
      status: 200,
      data: { email: user.email, user: authenticatedBody(user).data.user },
      meta: { is_authenticating: false },
    });
  }),

  http.post<never, { key?: string }>(`${BASE}/email/verify`, async ({ request }) => {
    await delay();
    const { key } = await request.json();
    const email = emailFromKey("verify", key ?? null);
    const user = email ? db.findUserByEmail(email) : undefined;
    if (!user)
      return badRequest({ message: "Invalid or expired key.", code: "invalid", param: "key" });
    user.verified = true;
    // verified, but (like allauth's default) not signed in
    return HttpResponse.json(unauthenticatedBody(), { status: 401 });
  }),

  http.post<never, { email?: string }>(`${BASE}/password/request`, async ({ request }) => {
    await delay();
    const { email } = await request.json();
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return badRequest({
        message: "Enter a valid email address.",
        code: "invalid",
        param: "email",
      });
    }
    return HttpResponse.json({ status: 200 });
  }),

  http.get(`${BASE}/password/reset`, async ({ request }) => {
    await delay();
    const email = emailFromKey("reset", request.headers.get("X-Password-Reset-Key"));
    const user = email ? db.findUserByEmail(email) : undefined;
    if (!user) {
      return badRequest({
        message: "The password reset token was invalid.",
        code: "token_invalid",
        param: "key",
      });
    }
    return HttpResponse.json({ status: 200, data: { user: authenticatedBody(user).data.user } });
  }),

  http.post<never, { key?: string; password?: string }>(
    `${BASE}/password/reset`,
    async ({ request }) => {
      await delay();
      const { key, password } = await request.json();
      const email = emailFromKey("reset", key ?? null);
      const user = email ? db.findUserByEmail(email) : undefined;
      if (!user) {
        return badRequest({
          message: "The password reset token was invalid.",
          code: "token_invalid",
          param: "key",
        });
      }
      const errors = password ? passwordProblems(password) : [required("password")];
      if (errors.length) return badRequest(...errors);
      user.password = password!;
      return HttpResponse.json(unauthenticatedBody(), { status: 401 });
    },
  ),

  // The real endpoint 302s to the provider; the mock skips that and signs in a
  // Google user. Visit /auth/callback?error=unknown to see a failed handshake.
  http.post(`${BASE}/provider/redirect`, async () => {
    await delay();
    const user =
      db.findUserByEmail(GOOGLE_EMAIL) ??
      Object.assign(db.addUser(GOOGLE_EMAIL, ""), { has_usable_password: false });
    db.signIn(user);
    return new HttpResponse(null, { status: 204 });
  }),

  // allauth answers a successful logout with 401 ("no longer authenticated").
  http.delete(`${BASE}/session`, async () => {
    await delay();
    db.signOut();
    return HttpResponse.json(unauthenticatedBody(), { status: 401 });
  }),
];
