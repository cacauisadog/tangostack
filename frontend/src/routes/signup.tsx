import { createFileRoute } from "@tanstack/react-router";
import SignupPage from "#/components/auth/SignupPage";

export const Route = createFileRoute("/signup")({ component: SignupPage });
