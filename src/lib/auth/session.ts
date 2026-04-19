import { randomBytes, createHash } from "node:crypto";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { type AuthUser, type PermissionKey } from "@/lib/auth/permissions";
import { verifyPassword } from "@/lib/auth/password";
const SESSION_TTL_DAYS = 14;

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function mapUserToAuthUser(sessionUser: {
  id: string;
  email: string;
  name: string;
  role: { name: string; permissions: { permission: { key: string } }[] };
}): AuthUser {
  return {
    id: sessionUser.id,
    email: sessionUser.email,
    name: sessionUser.name,
    roleName: sessionUser.role.name,
    permissions: sessionUser.role.permissions.map((item) => item.permission.key as PermissionKey),
  };
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionToken) {
    return null;
  }

  const tokenHash = hashSessionToken(sessionToken);
  const session = await db.session.findUnique({
    where: {
      tokenHash,
    },
    include: {
      user: {
        include: {
          role: {
            include: {
              permissions: {
                include: {
                  permission: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!session || session.status !== "ACTIVE" || session.expiresAt <= new Date()) {
    cookieStore.delete(SESSION_COOKIE_NAME);
    return null;
  }

  return mapUserToAuthUser(session.user);
}

export async function requireUser(permission?: PermissionKey) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (permission && !user.permissions.includes(permission)) {
    redirect("/dashboard?denied=1");
  }

  return user;
}

export async function signIn(email: string, password: string) {
  const user = await db.user.findUnique({
    where: { email: email.toLowerCase() },
    include: {
      role: {
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      },
    },
  });

  if (!user || user.status !== "ACTIVE") {
    return { success: false as const, message: "Invalid email or password." };
  }

  const isValid = await verifyPassword(password, user.passwordHash);

  if (!isValid) {
    return { success: false as const, message: "Invalid email or password." };
  }

  const sessionToken = randomBytes(32).toString("hex");
  const tokenHash = hashSessionToken(sessionToken);
  const headerStore = await headers();
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  await db.session.create({
    data: {
      userId: user.id,
      tokenHash,
      status: "ACTIVE",
      expiresAt,
      ipAddress: headerStore.get("x-forwarded-for") ?? headerStore.get("x-real-ip") ?? "local",
      userAgent: headerStore.get("user-agent") ?? "unknown",
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });

  await db.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  return { success: true as const, user: mapUserToAuthUser(user) };
}

export async function signOut() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (sessionToken) {
    await db.session.updateMany({
      where: {
        tokenHash: hashSessionToken(sessionToken),
        status: "ACTIVE",
      },
      data: {
        status: "REVOKED",
        revokedAt: new Date(),
      },
    });
  }

  cookieStore.delete(SESSION_COOKIE_NAME);
}

export { SESSION_COOKIE_NAME };
