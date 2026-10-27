import { delay, http, HttpResponse } from "msw";
import type {
  AuthenticatedResponse,
  AuthenticationResponse,
  ConflictResponse,
  ErrorResponse,
  ErrorResponseErrorsItem,
} from "#/api/generated-auth";
import { db, type MockUser } from "./db";

// allauth-shaped bodies (its own envelope, not Ninja's). Keep in sync with allauth's spec.
const BASE = "*/_allauth/browser/v1/auth";

const unauthenticatedBody = (): AuthenticationResponse => ({
  status: 401,
  data: { flows: [{ id: "login" }, { id: "signup" }] },
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
    } else if (db.findUserByEmail(email)) {
      errors.push({
        message: "A user is already registered with this email address.",
        code: "email_taken",
        param: "email",
      });
    }
    if (!password) errors.push(required("password"));
    else errors.push(...passwordProblems(password));
    if (errors.length) return badRequest(...errors);

    // No email verification, so signing up also signs in.
    const user = db.addUser(email!, password!);
    db.signIn(user);
    return HttpResponse.json(authenticatedBody(user));
  }),

  // allauth answers a successful logout with 401 ("no longer authenticated").
  http.delete(`${BASE}/session`, async () => {
    await delay();
    db.signOut();
    return HttpResponse.json(unauthenticatedBody(), { status: 401 });
  }),
];
