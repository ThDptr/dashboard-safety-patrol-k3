"use server";

export async function verifyPassword(password: string): Promise<boolean> {
  const secret = process.env.CRUD_SECRET;
  return password === secret;
}
