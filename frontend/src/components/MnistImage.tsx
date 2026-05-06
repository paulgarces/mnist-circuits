import { useEffect, useRef } from 'react'

type Props = {
  values: number[]
  size?: number
}

export default function MnistImage({ values, size = 80 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const data = ctx.createImageData(28, 28)
    for (let i = 0; i < 784; i++) {
      const g = Math.round(Math.max(0, Math.min(1, values[i])) * 255)
      data.data[i * 4] = g
      data.data[i * 4 + 1] = g
      data.data[i * 4 + 2] = g
      data.data[i * 4 + 3] = 255
    }
    ctx.putImageData(data, 0, 0)
  }, [values])

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
