# MNIST Circuit Playground

Interactive web app for poking at what individual neurons in a small MNIST classifier learn, and how groups of neurons wire together into circuits. The goal is to make neural network interpretability concrete for people who learn by clicking on things.

**Live demo:** https://mnist-circuits.vercel.app
**Backend API:** https://mnist-circuits-production.up.railway.app/accuracy?arch=medium

## Status

Week one of the rebuild is done. A deployed React frontend talks to a deployed FastAPI backend, four pre-trained MLPs of different shapes can be evaluated on the MNIST test set, and clicking a button returns its accuracy. That is currently all the deployed app does.

Phase 2 ports the actual interpretability tooling from the original Streamlit prototype:

- **Single-neuron view.** The weight map for a chosen neuron (the input image it most cares about), its per-digit response profile across the test set, and the test images that fire it hardest.
- **Source/sink circuits.** For any second-layer neuron, the first-layer neurons that excite or suppress it the most, plus its connection weights to each output digit.
- **Path tracing.** For a specific input image, decomposing how a chosen second-layer neuron's activation is built up from its inputs.
- **Ablation.** Zero out chosen neurons and compare per-digit accuracy against the unmodified baseline.

> Screenshot will get added when the UI does more than four buttons.

## The four models

All four are 3-layer MLPs (`fc1: 784 -> h1`, `fc2: h1 -> h2`, `fc3: h2 -> 10`) trained on MNIST for 3 epochs:

| arch    | hidden 1 | hidden 2 | activation | test acc |
|---------|----------|----------|------------|----------|
| small   | 128      | 32       | relu       | 95.5%    |
| medium  | 256      | 64       | relu       | 96.2%    |
| tanh    | 256      | 64       | tanh       | 96.3%    |
| deep    | 512      | 128      | relu       | 97.3%    |

Trained once locally; weights are checked into `backend/models/` as `.pt` files. The deployed backend never trains, only loads.

## Tech stack

- **Backend:** FastAPI, PyTorch (CPU only), uvicorn, Python 3.11
- **Frontend:** Vite, React, TypeScript
- **Hosting:** Railway (backend), Vercel (frontend), both auto-deploy on push to `main`

## Run locally

You'll need Python 3.11 (conda or any venv tool) and Node 20+.

**Backend:**

```
conda create -n mnist-circuits python=3.11
conda activate mnist-circuits
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

Listens on `http://localhost:8000`. Try `curl "http://localhost:8000/accuracy?arch=medium"` (note the quotes; zsh treats `?` as a glob).

**Frontend, in another terminal:**

```
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. By default it talks to `http://localhost:8000`. To override, copy `frontend/.env.example` to `frontend/.env.local` and set `VITE_API_URL`.

**Retraining the models** (only needed if you want to change architectures or training settings):

```
cd backend
python train_models.py
```

Writes new `.pt` files into `backend/models/`. A few minutes on CPU.

## Repo layout

```
backend/
  main.py            FastAPI app, /accuracy endpoint
  model.py           SimpleNN class + load_model()
  train_models.py    one-shot training script
  models/            checked-in .pt files for all four archs
  Procfile           Railway start command
  requirements.txt
  .python-version    pins 3.11 for Nixpacks
frontend/
  src/App.tsx        the actual UI
  src/App.css
  .env.example       documents VITE_API_URL
```
