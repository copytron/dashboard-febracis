import { getRequestHeaders } from "@tanstack/react-start/server";
import { auth } from "@/lib/auth";
import { db } from "@/db/client";
import { sql } from "drizzle-orm";

/**
 * Get the current authenticated user's session from the request headers.
 * Must be called inside a createServerFn handler.
 */
export async function getServerSession() {
  const headers = getRequestHeaders();
  const session = await auth.api.getSession({ headers });
  return session;
}

/**
 * Get the current user's role from user_roles table.
 * Returns "viewer" if no role is set.
 */
export async function getUserRole(userId: string): Promise<string> {
  const result = await db.execute(
    sql`SELECT role FROM user_roles WHERE user_id = ${userId} LIMIT 1`
  );
  const rows = result as unknown as { role: string }[];
  return rows[0]?.role ?? "viewer";
}

/**
 * Check if the current request is from an admin user.
 * Throws if not authenticated or not admin.
 */
export async function requireAdmin() {
  const session = await getServerSession();
  if (!session?.user) throw new Error("Não autenticado");
  const role = await getUserRole(session.user.id);
  if (role !== "admin") throw new Error("Acesso negado: apenas administradores podem realizar esta ação");
  return session.user;
}
