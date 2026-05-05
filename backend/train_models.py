# trains the four architectures from the streamlit app and saves weights
# run this once locally - the deployed backend just loads these files
# usage: python train_models.py

import os
import torch
import torch.nn as nn
from torchvision import datasets, transforms
from torch.utils.data import DataLoader

ARCHITECTURES = {
    "small":  {"hidden1": 128, "hidden2": 32,  "activation": "relu"},
    "medium": {"hidden1": 256, "hidden2": 64,  "activation": "relu"},
    "tanh":   {"hidden1": 256, "hidden2": 64,  "activation": "tanh"},
    "deep":   {"hidden1": 512, "hidden2": 128, "activation": "relu"},
}

class SimpleNN(nn.Module):
    def __init__(self, cfg):
        super().__init__()
        act = nn.ReLU if cfg["activation"] == "relu" else nn.Tanh
        self.fc1 = nn.Linear(784, cfg["hidden1"])
        self.fc2 = nn.Linear(cfg["hidden1"], cfg["hidden2"])
        self.fc3 = nn.Linear(cfg["hidden2"], 10)
        self.act = act()

    def forward(self, x):
        if x.dim() > 2: x = x.view(x.size(0), -1)
        x = self.act(self.fc1(x))
        x = self.act(self.fc2(x))
        return self.fc3(x)

def train_one(name, cfg, epochs=3):
    torch.manual_seed(42)
    transform = transforms.ToTensor()
    train_data = datasets.MNIST(root="./data", train=True, download=True, transform=transform)
    loader = DataLoader(train_data, batch_size=256, shuffle=True)

    model = SimpleNN(cfg)
    opt = torch.optim.Adam(model.parameters(), lr=0.001)
    loss_fn = nn.CrossEntropyLoss()

    for ep in range(epochs):
        for xb, yb in loader:
            pred = model(xb)
            loss = loss_fn(pred, yb)
            opt.zero_grad(); loss.backward(); opt.step()
        print(f"  {name} epoch {ep+1}/{epochs} loss={loss.item():.4f}")

    out_path = f"../models/{name}.pt"
    # save both the weights and the config so we can reconstruct the model later
    torch.save({"state_dict": model.state_dict(), "config": cfg}, out_path)
    print(f"  saved {out_path}")

if __name__ == "__main__":
    os.makedirs("../models", exist_ok=True)
    for name, cfg in ARCHITECTURES.items():
        print(f"training {name}...")
        train_one(name, cfg)
    print("done")