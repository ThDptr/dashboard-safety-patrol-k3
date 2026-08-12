"use server";

export async function verifyPassword(password: string): Promise<boolean> {
  const secret = process.env.CRUD_SECRET || "rahasia_rsomh_k3";
  return password.trim() === secret.trim();
}
