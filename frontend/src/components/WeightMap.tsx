import { useEffect, useRef } from 'react'

type Props = {
  values: number[]
  min: number
  max: number
  size?: number
}

export default function WeightMap({ values, min, max, size = 220 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const maxAbs = Math.max(Math.abs(min), Math.abs(max), 1e-9)
    const data = ctx.createImageData(28, 28)
    for (let i = 0; i < 784; i++) {
      const t = Math.max(-1, Math.min(1, values[i] / maxAbs))
      let r: number, g: number, b: number
      if (t <= 0) {
        const k = -t
        r = Math.round(255 - k * 205)
        g = Math.round(255 - k * 205)
        b = Math.round(255 - k * 55)
      } else {
        r = Math.round(255 - t * 55)
        g = Math.round(255 - t * 205)
        b = Math.round(255 - t * 205)
      }
      data.data[i * 4] = r
      data.data[i * 4 + 1] = g
      data.data[i * 4 + 2] = b
      data.data[i * 4 + 3] = 255
    }
    ctx.putImageData(data, 0, 0)
  }, [values, min, max])

  return (
    <canvas
      ref={canvasRef}
      width={28}
      height={28}
      style={{
        width: size,
        height: size,
        imageRendering: 'pixelated',
        border: '1px solid #ccc',
        display: 'block',
      }}
    />
  )
}
