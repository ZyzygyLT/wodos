"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import RaceSelector from "@/components/game/RaceSelector"

interface ClassData {
  id: number; name: string; slug: string; icon: string
  role: string; position: string; difficulty: string
  description: string; baseAttrs: Record<string, number>
  primaryAttr: string; secondaryAttr: string
}

interface RaceData {
  id: number; name: string; slug: string; icon: string
  flavor: string; attrMods: Record<string, number>
  racialTraits: { name: string; desc: string }[]
}

export default function Onboarding() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [classes, setClasses] = useState<ClassData[]>([])
  const [races, setRaces] = useState<RaceData[]>([])
  const [selectedClass, setSelectedClass] = useState<ClassData | null>(null)
  const [selectedRace, setSelectedRace] = useState<RaceData | null>(null)
  const [name, setName] = useState("")
  const [error, setError] = useState("")
  const [loadError, setLoadError] = useState("")
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function loadOptions() {
      setFetching(true)
      setLoadError("")
      try {
        const [classResponse, raceResponse] = await Promise.all([
          fetch("/api/classes"),
          fetch("/api/races"),
        ])
        if (!classResponse.ok || !raceResponse.ok) {
          throw new Error("No se pudieron cargar las clases y razas.")
        }

        const [classData, raceData] = await Promise.all([
          classResponse.json(),
          raceResponse.json(),
        ])
        if (!Array.isArray(classData) || !Array.isArray(raceData) || classData.length === 0 || raceData.length === 0) {
          throw new Error("No hay clases o razas disponibles. Intentá nuevamente más tarde.")
        }

        if (!cancelled) {
          setClasses(classData)
          setRaces(raceData)
        }
      } catch (loadFailure) {
        if (!cancelled) {
          setLoadError(loadFailure instanceof Error ? loadFailure.message : "Error de conexión al cargar las opciones.")
        }
      } finally {
        if (!cancelled) setFetching(false)
      }
    }

    void loadOptions()
    return () => { cancelled = true }
  }, [loadAttempt])

  async function handleCreate() {
    if (!selectedClass || !selectedRace || !name.trim()) return
    setLoading(true)
    setError("")

    try {
      const res = await fetch("/api/hero/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), classId: selectedClass.id, raceId: selectedRace.id }),
      })

      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "No se pudo crear el héroe. Intentá nuevamente.")
        return
      }

      router.push("/dashboard")
    } catch {
      setError("Error de conexión. Revisá tu conexión e intentá nuevamente.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="flex justify-center gap-2 mb-8">
          {[1, 2, 3].map(s => (
            <div key={s} className={`w-3 h-3 rounded-full ${step >= s ? 'bg-yellow-400' : 'bg-gray-700'}`} />
          ))}
        </div>

        {step === 1 && (
          <>
            <h1 className="text-2xl font-bold text-center mb-6">Elegí tu clase</h1>
            {fetching ? (
              <p className="text-center text-gray-400 py-12">Cargando clases...</p>
            ) : loadError ? (
              <div className="text-center py-12 space-y-4">
                <p role="alert" className="text-red-400">{loadError}</p>
                <button onClick={() => setLoadAttempt(attempt => attempt + 1)}
                  className="px-5 py-2 rounded bg-yellow-500 hover:bg-yellow-400 text-black font-semibold transition">
                  Reintentar
                </button>
              </div>
            ) : (
              <div className="grid gap-4">
                {classes.map(c => (
                  <button key={c.id} onClick={() => { setSelectedClass(c); setStep(2) }}
                    className={`text-left p-4 rounded-lg border-2 transition ${selectedClass?.id === c.id ? 'border-yellow-400 bg-gray-800' : 'border-gray-700 bg-gray-900 hover:border-gray-500'}`}>
                    <div className="text-2xl mb-1">{c.icon} {c.name}</div>
                    <div className="text-sm text-gray-400">{c.description}</div>
                    <div className="flex gap-2 mt-2 text-xs">
                      <span className="px-2 py-0.5 bg-gray-800 rounded">{c.role}</span>
                      <span className="px-2 py-0.5 bg-gray-800 rounded">{c.position}</span>
                      <span className="px-2 py-0.5 bg-gray-800 rounded">{c.difficulty}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="text-2xl font-bold text-center mb-6">Elegí tu raza</h1>
            <RaceSelector
              races={races as any[]}
              classAttrs={selectedClass?.baseAttrs ?? {}}
              onSelect={(raceId) => setSelectedRace(races.find(r => r.id === raceId) ?? null)}
            />
            <div className="flex gap-3 mt-4">
              <button onClick={() => setStep(1)} className="flex-1 py-3 rounded bg-gray-800 hover:bg-gray-700 transition text-sm">
                ← Volver a clases
              </button>
              <button onClick={() => setStep(3)} disabled={!selectedRace}
                className="flex-1 py-3 rounded bg-yellow-500 hover:bg-yellow-400 text-black font-bold transition text-sm disabled:opacity-50">
                Continuar →
              </button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h1 className="text-2xl font-bold text-center mb-6">Nombre de tu héroe</h1>
            <div className="bg-gray-900 p-6 rounded-lg border border-gray-700">
              <div className="text-center mb-4">
                <span className="text-3xl">{selectedClass?.icon} {selectedRace?.icon}</span>
                <p className="text-lg font-semibold mt-1">{selectedClass?.name} · {selectedRace?.name}</p>
              </div>
              <input
                value={name} onChange={e => setName(e.target.value)}
                placeholder="Nombre del héroe"
                maxLength={30}
                className="w-full p-3 rounded bg-gray-800 border border-gray-600 text-white text-center text-lg mb-4"
              />
              {error && <p className="text-red-400 text-sm text-center mb-2">{error}</p>}
              <div className="flex gap-3">
                <button onClick={() => setStep(2)} className="flex-1 py-3 rounded bg-gray-800 hover:bg-gray-700 transition">
                  ← Atrás
                </button>
                <button onClick={handleCreate} disabled={loading || !name.trim() || name.trim().length < 2}
                  className="flex-1 py-3 rounded bg-yellow-500 hover:bg-yellow-400 text-black font-bold transition disabled:opacity-50">
                  {loading ? "Creando..." : "¡Crear héroe!"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
