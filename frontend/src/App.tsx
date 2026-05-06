import { BrowserRouter, NavLink, Navigate, Route, Routes } from 'react-router-dom'
import Home from './routes/Home'
import Neuron from './routes/Neuron'
import Circuit from './routes/Circuit'
import './App.css'

export default function App() {
  return (
    <BrowserRouter>
      <header>
        <h1>MNIST Circuit Playground</h1>
        <nav>
          <NavLink to="/" end>Accuracy</NavLink>
          <NavLink to="/neuron">Neuron explorer</NavLink>
          <NavLink to="/circuit">Circuit</NavLink>
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/neuron" element={<Navigate to="/neuron/medium/fc1/0" replace />} />
          <Route path="/neuron/:arch/:layer/:neuronId" element={<Neuron />} />
          <Route path="/circuit" element={<Navigate to="/circuit/medium/0" replace />} />
          <Route path="/circuit/:arch/:neuronId" element={<Circuit />} />
        </Routes>
      </main>
    </BrowserRouter>
  )
}
