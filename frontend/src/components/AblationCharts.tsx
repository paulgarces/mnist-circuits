import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

type Props = {
  perDigitTotal: number[]
  baseline: number[]
  ablated: number[]
}

export default function AblationCharts({
  perDigitTotal,
  baseline,
  ablated,
}: Props) {
  const groupedData = perDigitTotal.map((t, c) => ({
    digit: c,
    baseline: baseline[c] / t,
    ablated: ablated[c] / t,
  }))

  const deltaData = perDigitTotal.map((t, c) => ({
    digit: c,
    delta_pp: ((ablated[c] - baseline[c]) / t) * 100,
  }))

  return (
    <>
      <h3 style={{ marginTop: '1.5rem' }}>Per-digit accuracy</h3>
      <div style={{ width: '100%', height: 240 }}>
        <ResponsiveContainer>
          <BarChart data={groupedData} margin={{ top: 10, right: 10, bottom: 10, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="digit" />
            <YAxis
              domain={[0, 1]}
              tickFormatter={(v) =>
                typeof v === 'number' ? `${(v * 100).toFixed(0)}%` : String(v)
              }
            />
            <Tooltip
              formatter={(v) =>
                typeof v === 'number' ? `${(v * 100).toFixed(2)}%` : String(v)
              }
            />
            <Legend />
            <Bar dataKey="baseline" fill="#888" />
            <Bar dataKey="ablated" fill="#aa3333" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <h3 style={{ marginTop: '1.5rem' }}>Delta (percentage points)</h3>
      <div style={{ width: '100%', height: 220 }}>
        <ResponsiveContainer>
          <BarChart data={deltaData} margin={{ top: 10, right: 10, bottom: 10, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="digit" />
            <YAxis
              tickFormatter={(v) =>
                typeof v === 'number' ? `${v.toFixed(1)}pp` : String(v)
              }
            />
            <ReferenceLine y={0} stroke="#999" />
            <Tooltip
              formatter={(v) =>
                typeof v === 'number' ? `${v.toFixed(2)}pp` : String(v)
              }
            />
            <Bar dataKey="delta_pp">
              {deltaData.map((d, i) => (
                <Cell
                  key={i}
                  fill={
                    d.delta_pp < 0 ? '#aa3333' : d.delta_pp > 0 ? '#3366aa' : '#ccc'
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  )
}
