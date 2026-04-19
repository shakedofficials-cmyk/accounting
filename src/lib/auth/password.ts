import { compare, hash } from "bcryptjs";

export const hashPassword = (value: string) => hash(value, 12);

export const verifyPassword = (value: string, passwordHash: string) => compare(value, passwordHash);
