import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import torch

from model import ARCHITECTURES, load_model
from activations import warmup, get_test_set


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
