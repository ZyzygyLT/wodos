import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { getHeroByUserId } from "@/lib/hero-utils"

export default async function Home() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const hero = await getHeroByUserId(session.user.id)
  if (!hero) redirect("/onboarding")

  redirect("/dashboard")
}
