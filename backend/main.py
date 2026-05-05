import os
from fastapi import FastAPI, HTTPException
import torch
from torch.utils.data import DataLoader
from torchvision import datasets, transforms

from model import ARCHITECTURES, load_model

app = FastAPI(title="MNIST Circuit Playground")

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")

_TEST_LOADER: DataLoader | None = None
_ACCURACY_CACHE: dict[str, float] = {}


def get_test_loader() -> DataLoader:
    global _TEST_LOADER
    if _TEST_LOADER is None:
        test_data = datasets.MNIST(
            root=DATA_DIR, train=False, download=True, transform=transforms.ToTensor()
        )
        _TEST_LOADER = DataLoader(test_data, batch_size=512, shuffle=False)
    return _TEST_LOADER


@app.get("/accuracy")
def accuracy(arch: str):
    if arch not in ARCHITECTURES:
        raise HTTPException(
            status_code=400,
            detail=f"unknown arch '{arch}', expected one of {list(ARCHITECTURES)}",
        )
    if arch in _ACCURACY_CACHE:
        return {"arch": arch, "accuracy": _ACCURACY_CACHE[arch]}

    model = load_model(arch)
    correct = 0
    total = 0
    with torch.no_grad():
        for xb, yb in get_test_loader():
            preds = model(xb).argmax(dim=1)
            correct += (preds == yb).sum().item()
            total += yb.size(0)

    acc = correct / total
    _ACCURACY_CACHE[arch] = acc
    return {"arch": arch, "accuracy": acc}
