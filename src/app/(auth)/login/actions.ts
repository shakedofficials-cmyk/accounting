"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { signIn } from "@/lib/auth/session";

export type LoginActionState = {
  error?: string;
};

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export async function loginAction(_: LoginActionState, formData: FormData): Promise<LoginActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      error: "Please enter a valid email address and password.",
    };
  }

  const result = await signIn(parsed.data.email, parsed.data.password);

  if (!result.success) {
    return {
      error: result.message,
    };
  }

  redirect("/dashboard");
}
