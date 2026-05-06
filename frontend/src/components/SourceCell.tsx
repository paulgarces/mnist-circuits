import { Link } from 'react-router-dom'
import WeightMap from './WeightMap'

type Props = {
  arch: string
  fc1_id: number
  weight: number
  weight_map: { values: number[]; min: number; max: number }
}

const STRONG = 0.3

export default function SourceCell({ arch, fc1_id, weight, weight_map }: Props) {
  const absT = Math.min(Math.abs(weight) / STRONG, 1)
  const intensity = 0.3 + absT * 0.7
  const color =
    weight >= 0
      ? `rgba(180, 40, 40, ${intensity})`
      : `rgba(40, 70, 180, ${intensity})`
  const fontSize = `${1.0 + absT * 0.5}rem`
  const fontWeight = 500 + Math.round(absT * 200)
  const sign = weight >= 0 ? '+' : ''

  return (
    <Link to={`/neuron/${arch}/fc1/${fc1_id}`} className="source-cell">
      <WeightMap
        values={weight_map.values}
        min={weight_map.min}
        max={weight_map.max}
        size={70}
      />
      <div className="source-label">fc1 #{fc1_id}</div>
      <div className="source-weight" style={{ color, fontSize, fontWeight }}>
        {sign}
        {weight.toFixed(3)}
      </div>
    </Link>
  )
}
