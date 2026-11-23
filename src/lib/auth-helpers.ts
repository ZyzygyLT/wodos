import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { getActiveHeroByUserId } from "@/lib/hero-utils"

/**
 * Combines auth() session check + hero lookup.
 * Returns { heroId } on success, or a NextResponse error on failure.
 *
 * Usage in API routes:
 *   const result = await requireHero()
 *   if ("error" in result) return result.error
 *   const { heroId } = result
 */
export async function requireHero(): Promise<
  | { heroId: string }
  | { error: NextResponse }
> {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "No autenticado" }, { status: 401 }) }
  }

  const hero = await getActiveHeroByUserId(session.user.id, { select: { id: true } })
  if (!hero) {
    return { error: NextResponse.json({ error: "No tenés un héroe" }, { status: 404 }) }
  }

  return { heroId: hero.id }
}
