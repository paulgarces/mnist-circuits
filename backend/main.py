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


@app.get("/trace")
def trace(arch: str, neuron_id: int, image_idx: int, k: int = 5):
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
    h1 = model.fc1.weight.size(0)
    h2 = model.fc2.weight.size(0)
    if neuron_id < 0 or neuron_id >= h2:
        raise HTTPException(
            status_code=400,
            detail=f"neuron_id must be in [0, {h2 - 1}] for {arch}/fc2",
        )

    images, labels = get_test_set()
    n_images = images.size(0)
    if image_idx < 0 or image_idx >= n_images:
        raise HTTPException(
            status_code=400,
            detail=f"image_idx must be in [0, {n_images - 1}]",
        )

    fc1_acts_cached = get_activations(arch, "fc1")
    fc2_acts_cached = get_activations(arch, "fc2")
    eff_k = min(k, h1)

    with torch.no_grad():
        x = images[image_idx]
        fc1_pre = fc1_acts_cached[image_idx]
        h1_post = model.act(fc1_pre)
        weights = model.fc2.weight[neuron_id]
        bias = float(model.fc2.bias[neuron_id].item())

        contributions = h1_post * weights
        total_pre = float(contributions.sum().item()) + bias

        cached_pre = float(fc2_acts_cached[image_idx, neuron_id].item())
        if abs(total_pre - cached_pre) > 1e-3:
            raise RuntimeError(
                f"path-trace math mismatch: computed {total_pre:.6f} != "
                f"cached fc2_pre {cached_pre:.6f} for "
                f"{arch}/fc2/{neuron_id}@image_{image_idx}"
            )

        logits = model(x.unsqueeze(0))
        predicted_label = int(logits.argmax(dim=1).item())

        pos_ids = torch.topk(contributions, eff_k).indices.tolist()
        neg_ids = torch.topk(-contributions, eff_k).indices.tolist()

        W1 = model.fc1.weight

    def fc1_entries(ids):
        result = []
        for i in ids:
            w = W1[i]
            result.append({
                "fc1_id": int(i),
                "fc1_activation": float(h1_post[i].item()),
                "weight": float(weights[i].item()),
                "contribution": float(contributions[i].item()),
                "weight_map": {
                    "values": w.tolist(),
                    "min": float(w.min().item()),
                    "max": float(w.max().item()),
                },
            })
        return result

    return {
        "arch": arch,
        "neuron_id": neuron_id,
        "image_idx": image_idx,
        "h1": h1,
        "h2": h2,
        "n_images": n_images,
        "input_image": x.tolist(),
        "true_label": int(labels[image_idx].item()),
        "predicted_label": predicted_label,
        "fc2_bias": bias,
        "total_pre_activation": total_pre,
        "positive_contributors": fc1_entries(pos_ids),
        "negative_contributors": fc1_entries(neg_ids),
    }


def _parse_id_list(s: str, max_val: int, name: str) -> list[int]:
    s = s.strip()
    if not s:
        return []
    try:
        ids = sorted({int(x.strip()) for x in s.split(",") if x.strip()})
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"{name} must be comma-separated integers, got '{s}'",
        )
    for i in ids:
        if i < 0 or i >= max_val:
            raise HTTPException(
                status_code=400,
                detail=f"{name}: {i} out of range [0, {max_val - 1}]",
            )
    return ids


@app.get("/ablate")
def ablate(arch: str, fc1_ids: str = "", fc2_ids: str = ""):
    if arch not in ARCHITECTURES:
        raise HTTPException(
            status_code=400,
            detail=f"unknown arch '{arch}', expected one of {list(ARCHITECTURES)}",
        )

    model = load_model(arch)
    h1 = model.fc1.weight.size(0)
    h2 = model.fc2.weight.size(0)

    fc1_list = _parse_id_list(fc1_ids, h1, "fc1_ids")
    fc2_list = _parse_id_list(fc2_ids, h2, "fc2_ids")

    images, labels = get_test_set()
    n = labels.size(0)

    fc1_idx = torch.tensor(fc1_list, dtype=torch.long) if fc1_list else None
    fc2_idx = torch.tensor(fc2_list, dtype=torch.long) if fc2_list else None

    with torch.no_grad():
        baseline_logits = model(images)
        baseline_preds = baseline_logits.argmax(dim=1)

        h1_post = model.act(model.fc1(images))
        if fc1_idx is not None:
            h1_post = h1_post.clone()
            h1_post[:, fc1_idx] = 0
        h2_post = model.act(model.fc2(h1_post))
        if fc2_idx is not None:
            h2_post = h2_post.clone()
            h2_post[:, fc2_idx] = 0
        ablated_logits = model.fc3(h2_post)
        ablated_preds = ablated_logits.argmax(dim=1)

    def metrics(preds):
        correct = (preds == labels)
        per_correct: list[int] = []
        per_total: list[int] = []
        for c in range(10):
            mask = labels == c
            per_total.append(int(mask.sum().item()))
            per_correct.append(int(correct[mask].sum().item()))
        return per_correct, per_total, int(correct.sum().item())

    base_correct, per_total, base_overall = metrics(baseline_preds)
    abl_correct, _, abl_overall = metrics(ablated_preds)

    return {
        "arch": arch,
        "ablated": {"fc1": fc1_list, "fc2": fc2_list},
        "total": n,
        "per_digit_total": per_total,
        "baseline": {
            "overall_correct": base_overall,
            "per_digit_correct": base_correct,
        },
        "ablated_result": {
            "overall_correct": abl_overall,
            "per_digit_correct": abl_correct,
        },
    }
