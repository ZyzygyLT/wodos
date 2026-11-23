import { auth } from "@/auth"
import db from "@/lib/db"

export async function requireAdmin() {
  const session = await auth()
  if (!session?.user?.id) return { error: "No autenticado", status: 401 }
  const user = await db.user.findUnique({ where: { id: session.user.id } })
  if (!user?.isAdmin) return { error: "No autorizado", status: 403 }
  return { user }
}
