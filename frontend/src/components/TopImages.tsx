import MnistImage from './MnistImage'

type Img = {
  image: number[]
  activation: number
  label: number
  index: number
}

type Props = {
  images: Img[]
}

export default function TopImages({ images }: Props) {
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
        </div>
      ))}
    </div>
  )
}
