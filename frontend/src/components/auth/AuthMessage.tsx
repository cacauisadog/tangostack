import type { ReactNode } from "react";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "#/components/ui/card";

interface AuthMessageProps {
  title: string;
  description: ReactNode;
  /** Marks a failure, so assistive tech announces it. */
  error?: boolean;
  /** Where to go next (buttons or links). */
  children?: ReactNode;
}

/** A card with nothing to fill in: "check your inbox", "link expired", "done". */
export default function AuthMessage({ title, description, error, children }: AuthMessageProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription role={error ? "alert" : undefined}>{description}</CardDescription>
      </CardHeader>
      {children && <CardFooter className="flex flex-col gap-3 pt-4">{children}</CardFooter>}
    </Card>
  );
}
