import os
import torch
import torch.nn as nn

ARCHITECTURES = ("small", "medium", "tanh", "deep")

MODELS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models")


class SimpleNN(nn.Module):
    def __init__(self, cfg):
        super().__init__()
        act = nn.ReLU if cfg["activation"] == "relu" else nn.Tanh
        self.fc1 = nn.Linear(784, cfg["hidden1"])
        self.fc2 = nn.Linear(cfg["hidden1"], cfg["hidden2"])
        self.fc3 = nn.Linear(cfg["hidden2"], 10)
        self.act = act()

    def forward(self, x):
        if x.dim() > 2:
            x = x.view(x.size(0), -1)
        x = self.act(self.fc1(x))
        x = self.act(self.fc2(x))
        return self.fc3(x)


_MODEL_CACHE: dict[str, SimpleNN] = {}


def load_model(arch: str) -> SimpleNN:
    if arch in _MODEL_CACHE:
        return _MODEL_CACHE[arch]
    if arch not in ARCHITECTURES:
        raise ValueError(f"unknown arch '{arch}', expected one of {ARCHITECTURES}")

    path = os.path.join(MODELS_DIR, f"{arch}.pt")
    blob = torch.load(path, map_location="cpu", weights_only=True)
    model = SimpleNN(blob["config"])
    model.load_state_dict(blob["state_dict"])
    model.eval()
    _MODEL_CACHE[arch] = model
    return model
