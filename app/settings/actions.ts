"use server";

export async function verifySettingsPassword(pwd: string) {
  const secret = process.env.CRUD_SECRET || "rahasia_rsomh_k3";
  console.log(`[AUTH] Checking pwd: '${pwd}' against secret`);
  return pwd.trim() === secret.trim();
}
