"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export default function RegisterPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError("")

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    })

    if (res.ok) {
      // Auto-login after register
      const { signIn } = await import("next-auth/react")
      await signIn("credentials", { email, password, redirect: false })
      router.push("/")
    } else {
      const data = await res.json()
      setError(typeof data.error === 'string' ? data.error : "Error al registrarse")
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-gray-900 rounded-xl border border-gray-800 p-8">
        <h1 className="text-2xl font-bold text-center text-yellow-400 mb-6">⚔️ Ironhold</h1>
        <p className="text-center text-gray-400 mb-6">Crear cuenta</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input value={name} onChange={e => setName(e.target.value)}
            placeholder="Nombre" required minLength={2} maxLength={30}
            className="w-full p-3 rounded-lg bg-gray-800 border border-gray-700 text-white" />

          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="Email" required
            className="w-full p-3 rounded-lg bg-gray-800 border border-gray-700 text-white" />

          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="Contraseña (mín. 8 caracteres)" required minLength={8}
            className="w-full p-3 rounded-lg bg-gray-800 border border-gray-700 text-white" />

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}

          <button type="submit" disabled={loading}
            className="w-full py-3 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-black font-bold transition disabled:opacity-50">
            {loading ? "Creando cuenta..." : "Registrarse"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-4">
          ¿Ya tenés cuenta?{" "}
          <a href="/login" className="text-yellow-400 hover:underline">Iniciar sesión</a>
        </p>
      </div>
    </div>
  )
}
