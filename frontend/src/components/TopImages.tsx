import { Link } from 'react-router-dom'
import MnistImage from './MnistImage'

type Img = {
  image: number[]
  activation: number
  label: number
  index: number
}

type Props = {
  images: Img[]
  traceLinkBuilder?: (imageIndex: number) => string
}

export default function TopImages({ images, traceLinkBuilder }: Props) {
  return (
    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
      {images.map((img) => (
        <div
          key={img.index}
          style={{ textAlign: 'center', fontSize: '0.85em', color: '#555' }}
        >
          <MnistImage values={img.image} size={80} />
          <div>label {img.label}</div>
          <div>a={img.activation.toFixed(2)}</div>
          {traceLinkBuilder && (
            <Link
              to={traceLinkBuilder(img.index)}
              style={{ fontSize: '0.85em', color: '#4477aa', textDecoration: 'none' }}
            >
              Trace →
            </Link>
          )}
        </div>
      ))}
    </div>
  )
}
