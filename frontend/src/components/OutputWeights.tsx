import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

type Props = {
  values: number[]
}

export default function OutputWeights({ values }: Props) {
  const data = values.map((v, i) => ({ digit: i, weight: v }))
  return (
    <div style={{ width: '100%', height: 220 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 10, right: 10, bottom: 10, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="digit" />
          <YAxis />
          <ReferenceLine y={0} stroke="#999" />
          <Tooltip
            formatter={(v) => (typeof v === 'number' ? v.toFixed(3) : String(v))}
          />
          <Bar dataKey="weight">
            {data.map((d, i) => (
              <Cell key={i} fill={d.weight >= 0 ? '#aa3333' : '#3366aa'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
