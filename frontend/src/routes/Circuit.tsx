import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { API_URL, ARCHS, type Arch } from '../api'
import WeightMap from '../components/WeightMap'
import SourceCell from '../components/SourceCell'
import OutputWeights from '../components/OutputWeights'

type Source = {
  fc1_id: number
  weight: number
  weight_map: { values: number[]; min: number; max: number }
}

type CircuitData = {
  arch: Arch
  neuron_id: number
  h1: number
  h2: number
  self_weight_map: { values: number[]; min: number; max: number }
  digit_profile: number[]
  exciters: Source[]
  suppressors: Source[]
  output_weights: number[]
}

export default function Circuit() {
  const { arch, neuronId } = useParams()
  const navigate = useNavigate()

  const validArch = ARCHS.includes(arch as Arch)
  const id = Number(neuronId)
  const validId = Number.isInteger(id) && id >= 0
  const valid = validArch && validId

  const [data, setData] = useState<CircuitData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [neuronInput, setNeuronInput] = useState(String(id))

  useEffect(() => {
    setNeuronInput(String(id))
  }, [id])

  useEffect(() => {
    if (!valid) return
    const ctrl = new AbortController()
    setLoading(true)
    setError(null)
    fetch(`${API_URL}/circuit?arch=${arch}&neuron_id=${id}`, { signal: ctrl.signal })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.detail ?? `HTTP ${res.status}`)
        }
        return res.json() as Promise<CircuitData>
      })
      .then(setData)
      .catch((e) => {
        if (e.name === 'AbortError') return
        setError(e.message)
        setData(null)
      })
      .finally(() => setLoading(false))
    return () => ctrl.abort()
  }, [arch, id, valid])

  if (!valid) {
    return (
      <p>
        Invalid URL.{' '}
        <button onClick={() => navigate('/circuit/medium/0')}>Reset</button>
      </p>
    )
  }

  function go(a: string, n: number) {
    navigate(`/circuit/${a}/${n}`)
  }

  function commitNeuron() {
    const n = Number(neuronInput)
    if (Number.isInteger(n) && n >= 0 && n !== id) {
      go(arch!, n)
    } else if (!Number.isInteger(n) || n < 0) {
      setNeuronInput(String(id))
    }
  }

  const maxN = data ? data.h2 - 1 : null
  const peakDigit = data
    ? data.digit_profile.indexOf(Math.max(...data.digit_profile))
    : null

  return (
    <div>
      <div className="selectors">
        <div>
          <span className="label">Arch:</span>
          {ARCHS.map((a) => (
            <button key={a} onClick={() => go(a, 0)} disabled={a === arch}>
              {a}
            </button>
          ))}
        </div>
        <div>
          <span className="label">fc2 neuron:</span>
          <button
            onClick={() => go(arch!, Math.max(0, id - 1))}
            disabled={id === 0}
          >
            ←
          </button>
          <input
            type="number"
            value={neuronInput}
            onChange={(e) => setNeuronInput(e.target.value)}
            onBlur={commitNeuron}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            }}
            style={{ width: 70, margin: '0 0.4rem', padding: '0.2rem' }}
          />
          <button
            onClick={() => go(arch!, id + 1)}
            disabled={maxN !== null && id >= maxN}
          >
            →
          </button>
          {maxN !== null && (
            <span style={{ marginLeft: '0.75rem', color: '#666' }}>
              (0 - {maxN})
            </span>
          )}
        </div>
      </div>

      {loading && <p>Loading...</p>}
      {error && <p className="error">Error: {error}</p>}

      {data && !loading && !error && (
        <>
          <div className="circuit-header">
            <WeightMap
              values={data.self_weight_map.values}
              min={data.self_weight_map.min}
              max={data.self_weight_map.max}
              size={120}
            />
            <p className="caption" style={{ margin: '0.4rem 0 0.6rem' }}>
              Approximate input pattern (ignores fc1 activation function)
            </p>
            <h3 style={{ margin: 0 }}>fc2 #{data.neuron_id}</h3>
            <p className="caption">
              Fires hardest for digit {peakDigit} (mean{' '}
              {data.digit_profile[peakDigit!].toFixed(2)})
            </p>
            <Link to={`/neuron/${arch}/fc2/${id}`} className="cross-link">
              Open in neuron view →
            </Link>
          </div>

          <div className="sources-grid">
            <section>
              <h3>Top exciters → fc2 #{data.neuron_id}</h3>
              <div className="source-row">
                {data.exciters.map((e) => (
                  <SourceCell key={e.fc1_id} arch={arch!} {...e} />
                ))}
              </div>
            </section>
            <section>
              <h3>Top suppressors → fc2 #{data.neuron_id}</h3>
              <div className="source-row">
                {data.suppressors.map((s) => (
                  <SourceCell key={s.fc1_id} arch={arch!} {...s} />
                ))}
              </div>
            </section>
          </div>

          <section style={{ marginTop: '2rem' }}>
            <h3>Output weights — fc2 #{data.neuron_id} → digits</h3>
            <OutputWeights values={data.output_weights} />
            <p className="caption">
              Signed connection weights from this fc2 neuron to each output digit
              via fc3. Red bars push the network toward that digit; blue suppress
              it.
            </p>
          </section>
        </>
      )}
    </div>
  )
}
