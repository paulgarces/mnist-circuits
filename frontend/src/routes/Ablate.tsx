import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { API_URL, ARCHS, type Arch } from '../api'
import AblationCharts from '../components/AblationCharts'

type AblateData = {
  arch: Arch
  ablated: { fc1: number[]; fc2: number[] }
  total: number
  per_digit_total: number[]
  baseline: { overall_correct: number; per_digit_correct: number[] }
  ablated_result: { overall_correct: number; per_digit_correct: number[] }
}

export default function Ablate() {
  const { arch } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const validArch = ARCHS.includes(arch as Arch)
  const fc1Url = searchParams.get('fc1') ?? ''
  const fc2Url = searchParams.get('fc2') ?? ''

  const [fc1Input, setFc1Input] = useState(fc1Url)
  const [fc2Input, setFc2Input] = useState(fc2Url)
  const [data, setData] = useState<AblateData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { setFc1Input(fc1Url) }, [fc1Url])
  useEffect(() => { setFc2Input(fc2Url) }, [fc2Url])

  useEffect(() => {
    if (!validArch) return
    const ctrl = new AbortController()
    setLoading(true)
    setError(null)
    const url = new URL(`${API_URL}/ablate`)
    url.searchParams.set('arch', arch!)
    if (fc1Url) url.searchParams.set('fc1_ids', fc1Url)
    if (fc2Url) url.searchParams.set('fc2_ids', fc2Url)
    fetch(url.toString(), { signal: ctrl.signal })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.detail ?? `HTTP ${res.status}`)
        }
        return res.json() as Promise<AblateData>
      })
      .then(setData)
      .catch((e) => {
        if (e.name === 'AbortError') return
        setError(e.message)
        setData(null)
      })
      .finally(() => setLoading(false))
    return () => ctrl.abort()
  }, [arch, fc1Url, fc2Url, validArch])

  if (!validArch) {
    return (
      <p>
        Invalid URL.{' '}
        <button onClick={() => navigate('/ablate/medium')}>Reset</button>
      </p>
    )
  }

  function run() {
    const next = new URLSearchParams()
    if (fc1Input.trim()) next.set('fc1', fc1Input.trim())
    if (fc2Input.trim()) next.set('fc2', fc2Input.trim())
    setSearchParams(next)
  }

  function changeArch(newArch: string) {
    navigate(`/ablate/${newArch}`)
  }

  // The specific fc1/fc2 ids in this example are tied to the current trained
  // .pt files. If models are retrained from scratch, the "2-detector" neuron
  // will land on a different id and these numbers won't reproduce.
  function loadExample() {
    navigate('/ablate/deep?fc1=4,23,93,236,338&fc2=100')
  }

  let summaryNode = null
  if (data) {
    const t = data.total
    const b = data.baseline.overall_correct
    const a = data.ablated_result.overall_correct
    const delta = a - b
    const dpp = (delta / t) * 100
    const sign = delta >= 0 ? '+' : ''
    const deltaColor = delta < 0 ? '#aa3333' : delta > 0 ? '#3366aa' : '#666'
    summaryNode = (
      <div className="ablation-summary">
        <div>
          <div className="caption">baseline</div>
          <div className="big-number">
            {b}/{t} ({((b / t) * 100).toFixed(2)}%)
          </div>
        </div>
        <div className="arrow">→</div>
        <div>
          <div className="caption">ablated</div>
          <div className="big-number">
            {a}/{t} ({((a / t) * 100).toFixed(2)}%)
          </div>
        </div>
        <div>
          <div className="caption">delta</div>
          <div className="big-number" style={{ color: deltaColor }}>
            {sign}{delta} ({sign}{dpp.toFixed(2)}pp)
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="selectors">
        <div>
          <span className="label">Arch:</span>
          {ARCHS.map((a) => (
            <button key={a} onClick={() => changeArch(a)} disabled={a === arch}>
              {a}
            </button>
          ))}
        </div>
        <div>
          <span className="label">fc1 ids:</span>
          <input
            type="text"
            value={fc1Input}
            onChange={(e) => setFc1Input(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') run() }}
            placeholder="comma-separated, e.g. 0,1,2"
            className="ablation-input"
          />
        </div>
        <div>
          <span className="label">fc2 ids:</span>
          <input
            type="text"
            value={fc2Input}
            onChange={(e) => setFc2Input(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') run() }}
            placeholder="comma-separated, e.g. 5,10"
            className="ablation-input"
          />
        </div>
        <div>
          <button onClick={run}>Run ablation</button>
        </div>
      </div>

      <p className="caption trace-subtitle">
        Ablation forces these neurons' activations to zero, then runs the test
        set. Per-digit accuracy compared to baseline. Distributed
        representations mean small ablations usually barely move accuracy;
        finding a small set that moves it is the experiment.
      </p>

      <p className="caption trace-subtitle" style={{ marginTop: '-0.5rem' }}>
        <strong>Try:</strong> in <strong>deep</strong>, set fc1=
        <code>4,23,93,236,338</code> and fc2=<code>100</code> — the 2-detector
        you found in Circuit view, plus its top exciters. Click Run. Notice:
        the biggest accuracy drop is on digit 4, not digit 2. The neuron's
        role in the network isn't always what its top-activating images
        suggest.{' '}
        <button onClick={loadExample} className="link-button">
          Load this example
        </button>
      </p>

      {loading && <p>Loading...</p>}
      {error && <p className="error">Error: {error}</p>}

      {data && !loading && !error && (
        <>
          <div className="ablation-header">
            {data.ablated.fc1.length === 0 && data.ablated.fc2.length === 0 ? (
              <h3>Baseline (no ablation) — {data.arch}</h3>
            ) : (
              <h3>
                Ablating{' '}
                {data.ablated.fc1.length} fc1
                {data.ablated.fc1.length > 0 && ` [${data.ablated.fc1.join(', ')}]`}
                {' + '}
                {data.ablated.fc2.length} fc2
                {data.ablated.fc2.length > 0 && ` [${data.ablated.fc2.join(', ')}]`}
                {' in '}
                {data.arch}
              </h3>
            )}
            {summaryNode}
          </div>

          <AblationCharts
            perDigitTotal={data.per_digit_total}
            baseline={data.baseline.per_digit_correct}
            ablated={data.ablated_result.per_digit_correct}
          />

          <h3 style={{ marginTop: '2rem' }}>Per-digit absolute changes</h3>
          <table className="ablation-table">
            <thead>
              <tr>
                <th>digit</th>
                <th>baseline</th>
                <th>ablated</th>
                <th>Δ correct</th>
                <th>Δ pp</th>
              </tr>
            </thead>
            <tbody>
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((c) => {
                const b = data.baseline.per_digit_correct[c]
                const a = data.ablated_result.per_digit_correct[c]
                const t = data.per_digit_total[c]
                const d = a - b
                const dpp = ((a - b) / t) * 100
                const cls = d < 0 ? 'delta-neg' : d > 0 ? 'delta-pos' : ''
                return (
                  <tr key={c}>
                    <td>{c}</td>
                    <td>
                      {b}/{t} ({((b / t) * 100).toFixed(2)}%)
                    </td>
                    <td>
                      {a}/{t} ({((a / t) * 100).toFixed(2)}%)
                    </td>
                    <td className={cls}>
                      {d >= 0 ? '+' : ''}
                      {d}
                    </td>
                    <td className={cls}>
                      {dpp >= 0 ? '+' : ''}
                      {dpp.toFixed(2)}pp
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}
