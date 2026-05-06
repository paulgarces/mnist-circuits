import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

type Props = {
  values: number[]
}

export default function DigitProfile({ values }: Props) {
  const data = values.map((v, i) => ({ digit: i, mean: v }))
  return (
    <div style={{ width: '100%', height: 220 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 10, right: 10, bottom: 10, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="digit" />
          <YAxis />
          <Tooltip formatter={(v) => (typeof v === 'number' ? v.toFixed(3) : String(v))} />
          <Bar dataKey="mean" fill="#4477aa" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
