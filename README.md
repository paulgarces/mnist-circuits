# MNIST Circuit Playground

By Paul Garces, MS in Applied Analytics student at Columbia University.

Interactive web app for poking at what individual neurons in a small MNIST classifier learn, and how groups of neurons wire together into circuits. The goal is to make neural network interpretability concrete for people who learn by clicking on things.

**Live demo:** https://mnist-circuits.vercel.app
**Backend API:** https://mnist-circuits-production.up.railway.app/accuracy?arch=medium

## What it does

A deployed React frontend talks to a deployed FastAPI backend serving four pre-trained MLPs. Five pages, all cross-linked:

- **Accuracy.** Pick an architecture, get its test-set accuracy.
- **Neuron explorer.** For a chosen neuron: its weight map (the input image it most cares about), its per-digit response profile across the test set, and the test images that fire it hardest.
- **Circuit.** For any second-layer neuron, the first-layer neurons that excite or suppress it the most, plus its connection weights to each output digit.
- **Trace.** For a specific input image, decomposes how a chosen second-layer neuron's activation is built up from its inputs (`fc1 activation × weight = contribution`) for the top contributors, with a footnote on how much is left unshown.
- **Ablate.** Zero out chosen neurons and compare per-digit accuracy against the unmodified baseline. Includes a seeded example.

The pages link into each other: neuron ↔ circuit ↔ trace, source cells in the circuit view link to their neuron pages, and top-activating images in the neuron view link to their trace.

## A finding you can reproduce in the app

Neuron `deep/fc2/100` reads like a "2-detector" if you only look at its top-activating images, which are mostly 2s. But its output weights peak at digit 4, not 2. Ablating it along with its top exciters drops digit-4 accuracy by 7.74pp while digit-2 accuracy barely moves (0.97pp). So the neuron a surface view calls a "2-detector" is actually more involved in distinguishing 4s. A neuron's input role and output role can diverge, and you only see it by intervening.

Path tracing tells a related story about distributed representations: on image 9110 (an 8), the top 10 contributors to the target neuron's activation account for only about 0.3 of a total +8.3. Most of the activation is spread across neurons you never see in a top-k view.

## The four models

All four are 3-layer MLPs (`fc1: 784 -> h1`, `fc2: h1 -> h2`, `fc3: h2 -> 10`) trained on MNIST for 3 epochs:

| arch    | hidden 1 | hidden 2 | activation | test acc |
|---------|----------|----------|------------|----------|
| small   | 128      | 32       | relu       | 95.5%    |
| medium  | 256      | 64       | relu       | 96.2%    |
| tanh    | 256      | 64       | tanh       | 96.3%    |
| deep    | 512      | 128      | relu       | 97.3%    |

Trained once locally; weights are checked into `backend/models/` as `.pt` files. The deployed backend never trains, only loads. Activation matrices are precomputed at startup so per-neuron queries are fast.

## Tech stack

- **Backend:** FastAPI, PyTorch (CPU only), uvicorn, Python 3.11
- **Frontend:** Vite, React, TypeScript, react-router-dom
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

## Deferred (possible next steps)

- t-SNE / PCA embedding view and a confusion matrix (both existed in the original Streamlit prototype)
- Activation patching, sparse autoencoders, a guided lesson structure
- A short research writeup on how often input role vs output role diverges across neurons and models

## Repo layout

```
backend/
  main.py            FastAPI app, endpoints for all five views
  model.py           SimpleNN class + load_model()
  train_models.py    one-shot training script
  models/            checked-in .pt files for all four archs
  Procfile           Railway start command
  requirements.txt
  .python-version    pins 3.11 for Nixpacks
frontend/
  src/                React + TypeScript pages, one per view, cross-linked
  .env.example       documents VITE_API_URL
```
