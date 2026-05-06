import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { API_URL, ARCHS, type Arch } from '../api'
import MnistImage from '../components/MnistImage'
import ContributionCell from '../components/ContributionCell'

type Contributor = {
  fc1_id: number
  fc1_activation: number
  weight: number
  contribution: number
  weight_map: { values: number[]; min: number; max: number }
}

type TraceData = {
  arch: Arch
  neuron_id: number
  image_idx: number
  h1: number
  h2: number
  n_images: number
  input_image: number[]
  true_label: number
  predicted_label: number
  fc2_bias: number
  total_pre_activation: number
  positive_contributors: Contributor[]
  negative_contributors: Contributor[]
}

export default function Trace() {
  const { arch, neuronId, imageIdx } = useParams()
  const navigate = useNavigate()

  const validArch = ARCHS.includes(arch as Arch)
  const nid = Number(neuronId)
  const iid = Number(imageIdx)
  const validNid = Number.isInteger(nid) && nid >= 0
  const validIid = Number.isInteger(iid) && iid >= 0
  const valid = validArch && validNid && validIid

  const [data, setData] = useState<TraceData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [neuronInput, setNeuronInput] = useState(String(nid))
  const [imageInput, setImageInput] = useState(String(iid))

  useEffect(() => { setNeuronInput(String(nid)) }, [nid])
  useEffect(() => { setImageInput(String(iid)) }, [iid])

  useEffect(() => {
    if (!valid) return
    const ctrl = new AbortController()
    setLoading(true)
    setError(null)
    fetch(
      `${API_URL}/trace?arch=${arch}&neuron_id=${nid}&image_idx=${iid}`,
      { signal: ctrl.signal },
    )
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.detail ?? `HTTP ${res.status}`)
        }
        return res.json() as Promise<TraceData>
      })
      .then(setData)
      .catch((e) => {
        if (e.name === 'AbortError') return
        setError(e.message)
        setData(null)
      })
      .finally(() => setLoading(false))
    return () => ctrl.abort()
  }, [arch, nid, iid, valid])

  if (!valid) {
    return (
      <p>
        Invalid URL.{' '}
        <button onClick={() => navigate('/trace/medium/0/0')}>Reset</button>
      </p>
    )
  }

  function go(a: string, n: number, i: number) {
    navigate(`/trace/${a}/${n}/${i}`)
  }

  function commitNeuron() {
    const n = Number(neuronInput)
    if (Number.isInteger(n) && n >= 0 && n !== nid) go(arch!, n, iid)
    else if (!Number.isInteger(n) || n < 0) setNeuronInput(String(nid))
  }
  function commitImage() {
    const i = Number(imageInput)
    if (Number.isInteger(i) && i >= 0 && i !== iid) go(arch!, nid, i)
    else if (!Number.isInteger(i) || i < 0) setImageInput(String(iid))
  }

  const maxN = data ? data.h2 - 1 : null
  const maxI = data ? data.n_images - 1 : null

  let footnote: string | null = null
  if (data) {
    const shown = [...data.positive_contributors, ...data.negative_contributors]
    const shownSum = shown.reduce((s, c) => s + c.contribution, 0)
    const allSum = data.total_pre_activation - data.fc2_bias
    const remainingSum = allSum - shownSum
    const remainingCount = data.h1 - shown.length
    const sign = remainingSum >= 0 ? '+' : ''
    footnote = `Showing top ${data.positive_contributors.length} positive and top ${data.negative_contributors.length} negative of ${data.h1} fc1 neurons. The other ${remainingCount} contribute ${sign}${remainingSum.toFixed(2)} net.`
  }

  return (
    <div>
      <div className="selectors">
        <div>
          <span className="label">Arch:</span>
          {ARCHS.map((a) => (
            <button key={a} onClick={() => go(a, 0, iid)} disabled={a === arch}>
              {a}
            </button>
          ))}
        </div>
        <div>
          <span className="label">fc2 neuron:</span>
          <button
            onClick={() => go(arch!, Math.max(0, nid - 1), iid)}
            disabled={nid === 0}
          >←</button>
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
            onClick={() => go(arch!, nid + 1, iid)}
            disabled={maxN !== null && nid >= maxN}
          >→</button>
          {maxN !== null && (
            <span style={{ marginLeft: '0.75rem', color: '#666' }}>(0 - {maxN})</span>
          )}
        </div>
        <div>
          <span className="label">image:</span>
          <button
            onClick={() => go(arch!, nid, Math.max(0, iid - 1))}
            disabled={iid === 0}
          >←</button>
          <input
            type="number"
            value={imageInput}
            onChange={(e) => setImageInput(e.target.value)}
            onBlur={commitImage}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            }}
            style={{ width: 90, margin: '0 0.4rem', padding: '0.2rem' }}
          />
          <button
            onClick={() => go(arch!, nid, iid + 1)}
            disabled={maxI !== null && iid >= maxI}
          >→</button>
          {maxI !== null && (
            <span style={{ marginLeft: '0.75rem', color: '#666' }}>(0 - {maxI})</span>
          )}
        </div>
      </div>

      {loading && <p>Loading...</p>}
      {error && <p className="error">Error: {error}</p>}

      {data && !loading && !error && (
        <>
          <div className="circuit-header">
            <MnistImage values={data.input_image} size={120} />
            <p className="caption" style={{ margin: '0.4rem 0 0.6rem' }}>
              Test image #{data.image_idx} — true label {data.true_label}, predicted {data.predicted_label}
              {data.true_label !== data.predicted_label && ' (incorrect)'}
            </p>
            <h3 style={{ margin: 0 }}>fc2 #{data.neuron_id}</h3>
            <p className="caption">
              pre-activation: <strong>{data.total_pre_activation >= 0 ? '+' : ''}{data.total_pre_activation.toFixed(3)}</strong>
              {' '}(bias: {data.fc2_bias >= 0 ? '+' : ''}{data.fc2_bias.toFixed(3)})
            </p>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <Link to={`/circuit/${arch}/${nid}`} className="cross-link">
                Open in circuit view →
              </Link>
              <Link to={`/neuron/${arch}/fc2/${nid}`} className="cross-link">
                Open in neuron view →
              </Link>
            </div>
          </div>

          <p className="caption trace-subtitle">
            Decomposing fc2 #{data.neuron_id}'s pre-activation for image #{data.image_idx}.
            Each contributor is one fc1 neuron's vote: (its activation) × (its weight to fc2 #{data.neuron_id}).
          </p>

          <div className="sources-grid">
            <section>
              <h3>Top positive contributors</h3>
              <div className="source-row">
                {data.positive_contributors.map((c) => (
                  <ContributionCell key={c.fc1_id} arch={arch!} {...c} />
                ))}
              </div>
            </section>
            <section>
              <h3>Top negative contributors</h3>
              <div className="source-row">
                {data.negative_contributors.map((c) => (
                  <ContributionCell key={c.fc1_id} arch={arch!} {...c} />
                ))}
              </div>
            </section>
          </div>

          {footnote && <p className="caption footnote">{footnote}</p>}
        </>
      )}
    </div>
  )
}
