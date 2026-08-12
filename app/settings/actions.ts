"use server";

export async function verifySettingsPassword(pwd: string) {
  const secret = process.env.CRUD_SECRET || "rahasia_rsomh_k3";
  return pwd === secret;
}
