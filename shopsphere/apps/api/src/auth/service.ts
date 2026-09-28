import { prisma } from "../db/client.js";
import { hashPassword, verifyPassword } from "./password.js";
import { signToken } from "./jwt.js";

export class AuthError extends Error {}

export async function registerUser(email: string, password: string, name: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AuthError("An account with that email already exists");
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { email, passwordHash, name },
  });

  const token = signToken({ sub: user.id, email: user.email, role: user.role });
  return { token, user: toPublicUser(user) };
}

export async function loginUser(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    throw new AuthError("Invalid email or password");
  }

  const token = signToken({ sub: user.id, email: user.email, role: user.role });
  return { token, user: toPublicUser(user) };
}

function toPublicUser(user: { id: string; email: string; name: string; role: string }) {
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}
