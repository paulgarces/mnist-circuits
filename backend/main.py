import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import torch

from model import ARCHITECTURES, load_model
from activations import warmup, get_test_set, get_activations


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("[startup] warming caches...")
    timings = warmup()
    print("[startup] timings (seconds):")
    for k, v in timings.items():
        print(f"  {k}: {v:.2f}")
    print(f"  total: {sum(timings.values()):.2f}")
    yield


app = FastAPI(title="MNIST Circuit Playground", lifespan=lifespan)

ALLOWED_ORIGINS = os.environ.get(
    "ALLOWED_ORIGINS", "http://localhost:5173"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET"],
    allow_headers=["*"],
)

_ACCURACY_CACHE: dict[str, float] = {}


@app.get("/accuracy")
def accuracy(arch: str):
    if arch not in ARCHITECTURES:
        raise HTTPException(
            status_code=400,
            detail=f"unknown arch '{arch}', expected one of {list(ARCHITECTURES)}",
        )
    if arch in _ACCURACY_CACHE:
        return {"arch": arch, "accuracy": _ACCURACY_CACHE[arch]}

    images, labels = get_test_set()
    model = load_model(arch)
    with torch.no_grad():
        preds = model(images).argmax(dim=1)
    correct = (preds == labels).sum().item()
    acc = correct / labels.size(0)
    _ACCURACY_CACHE[arch] = acc
    return {"arch": arch, "accuracy": acc}


@app.get("/neuron")
def neuron(arch: str, layer: str, neuron_id: int):
    if arch not in ARCHITECTURES:
        raise HTTPException(
            status_code=400,
            detail=f"unknown arch '{arch}', expected one of {list(ARCHITECTURES)}",
        )
    if layer not in ("fc1", "fc2"):
        raise HTTPException(
            status_code=400,
            detail=f"unknown layer '{layer}', expected 'fc1' or 'fc2'",
        )

    model = load_model(arch)
    activations = get_activations(arch, layer)
    images, labels = get_test_set()
    hidden_size = activations.size(1)
    if neuron_id < 0 or neuron_id >= hidden_size:
        raise HTTPException(
            status_code=400,
            detail=f"neuron_id must be in [0, {hidden_size - 1}] for {arch}/{layer}",
        )

    with torch.no_grad():
        if layer == "fc1":
            w = model.fc1.weight[neuron_id]
        else:
            w = model.fc2.weight[neuron_id] @ model.fc1.weight

    neuron_acts = activations[:, neuron_id]
    digit_profile = [
        float(neuron_acts[labels == c].mean().item()) for c in range(10)
    ]

    top_idx = torch.topk(neuron_acts, 5).indices.tolist()
    top_images = [
        {
            "image": images[i].tolist(),
            "activation": float(neuron_acts[i].item()),
            "label": int(labels[i].item()),
            "index": int(i),
        }
        for i in top_idx
    ]

    return {
        "arch": arch,
        "layer": layer,
        "neuron_id": neuron_id,
        "hidden_size": hidden_size,
        "weight_map": {
            "values": w.tolist(),
            "min": float(w.min().item()),
            "max": float(w.max().item()),
        },
        "digit_profile": digit_profile,
        "top_images": top_images,
    }


@app.get("/circuit")
def circuit(arch: str, neuron_id: int, k: int = 5):
    if arch not in ARCHITECTURES:
        raise HTTPException(
            status_code=400,
            detail=f"unknown arch '{arch}', expected one of {list(ARCHITECTURES)}",
        )
    if k < 1 or k > 20:
        raise HTTPException(
            status_code=400, detail=f"k must be in [1, 20], got {k}"
        )

    model = load_model(arch)
    h2 = model.fc2.weight.size(0)
    h1 = model.fc1.weight.size(0)
    if neuron_id < 0 or neuron_id >= h2:
        raise HTTPException(
            status_code=400,
            detail=f"neuron_id must be in [0, {h2 - 1}] for {arch}/fc2",
        )

    eff_k = min(k, h1)
    fc2_acts = get_activations(arch, "fc2")
    _, labels = get_test_set()

    with torch.no_grad():
        incoming = model.fc2.weight[neuron_id]
        outgoing = model.fc3.weight[:, neuron_id]
        self_weights = incoming @ model.fc1.weight
        W1 = model.fc1.weight

        exciter_ids = torch.topk(incoming, eff_k).indices.tolist()
        suppressor_ids = torch.topk(-incoming, eff_k).indices.tolist()

    def fc1_entries(ids):
        result = []
        for i in ids:
            w = W1[i]
            result.append({
                "fc1_id": int(i),
                "weight": float(incoming[i].item()),
                "weight_map": {
                    "values": w.tolist(),
                    "min": float(w.min().item()),
                    "max": float(w.max().item()),
                },
            })
        return result

    neuron_acts = fc2_acts[:, neuron_id]
    digit_profile = [
        float(neuron_acts[labels == c].mean().item()) for c in range(10)
    ]

    return {
        "arch": arch,
        "neuron_id": neuron_id,
        "h1": h1,
        "h2": h2,
        "self_weight_map": {
            "values": self_weights.tolist(),
            "min": float(self_weights.min().item()),
            "max": float(self_weights.max().item()),
        },
        "digit_profile": digit_profile,
        "exciters": fc1_entries(exciter_ids),
        "suppressors": fc1_entries(suppressor_ids),
        "output_weights": outgoing.tolist(),
    }
