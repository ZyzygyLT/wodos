import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import db from "@/lib/db"
import bcrypt from "bcryptjs"

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db as any),
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const user = await db.user.findUnique({
          where: { email: credentials.email as string }
        })

        if (!user?.passwordHash) return null

        const valid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        )

        return valid ? user : null
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.userId = user.id
      return token
    },
    async session({ session, token }) {
      if (token.userId) session.user.id = token.userId as string
      return session
    }
  }
})
