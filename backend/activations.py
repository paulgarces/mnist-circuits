import os
import time
from typing import Optional

import torch
from torch.utils.data import DataLoader
from torchvision import datasets, transforms

from model import ARCHITECTURES, load_model

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")

_TEST_IMAGES: Optional[torch.Tensor] = None
_TEST_LABELS: Optional[torch.Tensor] = None
_FC1_CACHE: dict[str, torch.Tensor] = {}
_FC2_CACHE: dict[str, torch.Tensor] = {}


def get_test_set() -> tuple[torch.Tensor, torch.Tensor]:
    if _TEST_IMAGES is None or _TEST_LABELS is None:
        raise RuntimeError("test set not loaded; warmup() must run first")
    return _TEST_IMAGES, _TEST_LABELS


def get_activations(arch: str, layer: str) -> torch.Tensor:
    if arch not in ARCHITECTURES:
        raise ValueError(f"unknown arch {arch!r}")
    if layer == "fc2":
        return _FC2_CACHE[arch]
    if layer == "fc1":
        if arch not in _FC1_CACHE:
            _FC1_CACHE[arch] = _compute_layer(arch, "fc1")
        return _FC1_CACHE[arch]
    raise ValueError(f"layer must be 'fc1' or 'fc2', got {layer!r}")


# Pre-activation linear outputs across the test set, matching app.py's
# forward_hook(fc1)/forward_hook(fc2) semantics. ReLU networks can have
# negative values here, which is meaningful (the neuron is suppressed).
def _compute_layer(arch: str, layer: str) -> torch.Tensor:
    model = load_model(arch)
    images, _ = get_test_set()
    with torch.no_grad():
        fc1_pre = model.fc1(images)
        if layer == "fc1":
            return fc1_pre
        h1_post = model.act(fc1_pre)
        return model.fc2(h1_post)


def warmup() -> dict[str, float]:
    global _TEST_IMAGES, _TEST_LABELS
    timings: dict[str, float] = {}

    t0 = time.perf_counter()
    test_data = datasets.MNIST(
        root=DATA_DIR, train=False, download=True, transform=transforms.ToTensor()
    )
    loader = DataLoader(test_data, batch_size=len(test_data))
    images, labels = next(iter(loader))
    _TEST_IMAGES = images.view(images.size(0), -1)
    _TEST_LABELS = labels
    timings["test_set_load"] = time.perf_counter() - t0

    for arch in ARCHITECTURES:
        t0 = time.perf_counter()
        _FC2_CACHE[arch] = _compute_layer(arch, "fc2")
        timings[f"fc2_{arch}"] = time.perf_counter() - t0

    return timings
