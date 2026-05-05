import { useState } from 'react'
import './App.css'

const API_URL = 'http://localhost:8000'
const ARCHS = ['small', 'medium', 'tanh', 'deep'] as const
type Arch = typeof ARCHS[number]

type Result = { arch: Arch; accuracy: number }

function App() {
  const [result, setResult] = useState<Result | null>(null)
  const [loadingArch, setLoadingArch] = useState<Arch | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function fetchAccuracy(arch: Arch) {
    setLoadingArch(arch)
    setError(null)
    try {
      const res = await fetch(`${API_URL}/accuracy?arch=${arch}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as Result
      setResult(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setResult(null)
    } finally {
      setLoadingArch(null)
    }
  }

  return (
    <main>
      <h1>MNIST Circuit Playground</h1>
      <p>Pick an architecture to see its test-set accuracy.</p>
      <div className="buttons">
        {ARCHS.map((arch) => (
          <button
            key={arch}
            onClick={() => fetchAccuracy(arch)}
            disabled={loadingArch !== null}
          >
            {arch}
          </button>
        ))}
      </div>
      <div className="output">
        {loadingArch && <p>Evaluating {loadingArch}...</p>}
        {error && <p className="error">Error: {error}</p>}
        {result && !loadingArch && (
          <p>
            <strong>{result.arch}</strong>: {(result.accuracy * 100).toFixed(2)}%
          </p>
        )}
      </div>
    </main>
  )
}

export default App
