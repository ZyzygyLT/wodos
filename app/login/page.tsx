"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError("")

    const res = await signIn("credentials", {
      email, password, redirect: false,
    })

    if (res?.error) {
      setError("Credenciales inválidas")
      setLoading(false)
    } else {
      router.push("/")
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-gray-900 rounded-xl border border-gray-800 p-8">
        <h1 className="text-2xl font-bold text-center text-yellow-400 mb-6">⚔️ Ironhold</h1>
        <p className="text-center text-gray-400 mb-6">Iniciar sesión</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="Email" required
            className="w-full p-3 rounded-lg bg-gray-800 border border-gray-700 text-white" />

          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="Contraseña" required
            className="w-full p-3 rounded-lg bg-gray-800 border border-gray-700 text-white" />

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}

          <button type="submit" disabled={loading}
            className="w-full py-3 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-black font-bold transition disabled:opacity-50">
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-4">
          ¿No tenés cuenta?{" "}
          <a href="/register" className="text-yellow-400 hover:underline">Registrate</a>
        </p>
      </div>
    </div>
  )
}
