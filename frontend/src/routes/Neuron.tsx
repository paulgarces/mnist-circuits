import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { API_URL, ARCHS, LAYERS, type Arch, type Layer } from '../api'
import WeightMap from '../components/WeightMap'
import DigitProfile from '../components/DigitProfile'
import TopImages from '../components/TopImages'

type NeuronData = {
  arch: Arch
  layer: Layer
  neuron_id: number
  hidden_size: number
  weight_map: { values: number[]; min: number; max: number }
  digit_profile: number[]
  top_images: { image: number[]; activation: number; label: number; index: number }[]
}

export default function Neuron() {
  const { arch, layer, neuronId } = useParams()
  const navigate = useNavigate()

  const validArch = ARCHS.includes(arch as Arch)
  const validLayer = LAYERS.includes(layer as Layer)
  const id = Number(neuronId)
  const validId = Number.isInteger(id) && id >= 0
  const valid = validArch && validLayer && validId

  const [data, setData] = useState<NeuronData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [neuronInput, setNeuronInput] = useState(String(id))

  useEffect(() => {
    setNeuronInput(String(id))
  }, [id])

  useEffect(() => {
    if (!valid) return
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    fetch(`${API_URL}/neuron?arch=${arch}&layer=${layer}&neuron_id=${id}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.detail ?? `HTTP ${res.status}`)
        }
        return res.json() as Promise<NeuronData>
      })
      .then(setData)
      .catch((e) => {
        if (e.name === 'AbortError') return
        setError(e.message)
        setData(null)
      })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [arch, layer, id, valid])

  if (!valid) {
    return (
      <p>
        Invalid URL.{' '}
        <button onClick={() => navigate('/neuron/medium/fc1/0')}>Reset</button>
      </p>
    )
  }

  function go(a: string, l: string, n: number) {
    navigate(`/neuron/${a}/${l}/${n}`)
  }

  function commitNeuron() {
    const n = Number(neuronInput)
    if (Number.isInteger(n) && n >= 0 && n !== id) {
      go(arch!, layer!, n)
    } else if (!Number.isInteger(n) || n < 0) {
      setNeuronInput(String(id))
    }
  }

  const maxN = data ? data.hidden_size - 1 : null

  return (
    <div>
      <div className="selectors">
        <div>
          <span className="label">Arch:</span>
          {ARCHS.map((a) => (
            <button key={a} onClick={() => go(a, layer!, 0)} disabled={a === arch}>
              {a}
            </button>
          ))}
        </div>
        <div>
          <span className="label">Layer:</span>
          {LAYERS.map((l) => (
            <button key={l} onClick={() => go(arch!, l, 0)} disabled={l === layer}>
              {l}
            </button>
          ))}
        </div>
        <div>
          <span className="label">Neuron:</span>
          <button onClick={() => go(arch!, layer!, Math.max(0, id - 1))} disabled={id === 0}>
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
            onClick={() => go(arch!, layer!, id + 1)}
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

      {data && !loading && !error && layer === 'fc2' && (
        <Link to={`/circuit/${arch}/${id}`} className="cross-link">
          View as circuit →
        </Link>
      )}

      {data && !loading && !error && (
        <div className="neuron-grid">
          <section>
            <h3>Weight map</h3>
            <WeightMap
              values={data.weight_map.values}
              min={data.weight_map.min}
              max={data.weight_map.max}
            />
            <p className="caption">
              Red pixels boost activation; blue suppress it.
              {layer === 'fc2' && ' Approximate input pattern (ignores fc1 activation function).'}
            </p>
          </section>
          <section>
            <h3>Digit profile</h3>
            <DigitProfile values={data.digit_profile} />
            <p className="caption">
              Mean pre-activation per digit class across the test set.
            </p>
          </section>
          <section className="full-row">
            <h3>Top activating images</h3>
            <TopImages
              images={data.top_images}
              traceLinkBuilder={
                layer === 'fc2'
                  ? (idx) => `/trace/${arch}/${id}/${idx}`
                  : undefined
              }
            />
          </section>
        </div>
      )}
    </div>
  )
}
