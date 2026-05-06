import { useParams } from 'react-router-dom'

export default function Neuron() {
  const { arch, layer, neuronId } = useParams()
  return (
    <>
      <p>Neuron explorer placeholder.</p>
      <pre>arch={arch} layer={layer} neuronId={neuronId}</pre>
    </>
  )
}
