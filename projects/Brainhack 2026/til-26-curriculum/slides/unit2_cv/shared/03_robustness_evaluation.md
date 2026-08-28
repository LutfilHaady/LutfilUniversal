---
presentationID: 1VdSnW8JBU4fa4pUs6KK7gR4tsxHh88cL-pm1KUBSxgs
title: "\"Robustness Evaluation\""
---

# Robustness Evaluation

How to measure whether a model holds up beyond clean test data.

---

## Clean Accuracy vs. Robust Accuracy

**Two different questions about your model**

**Clean accuracy**: performance on examples drawn from the same distribution as training data, with no deliberate manipulation
- "How well does the model work under normal conditions?"

**Robust accuracy**: performance on examples that have been perturbed in some controlled way
- "How well does the model work when something is trying to fool it, or when the input is degraded?"

---

## Why Clean and Robust Accuracy Can Diverge

**High clean accuracy does not guarantee robustness**

Why they can diverge:
- A model can achieve 95% clean accuracy by memorizing training distribution statistics
- Those same statistics become a liability when the input is shifted, corrupted, or deliberately perturbed
- A model with 95% clean accuracy may drop to 20% robust accuracy under modest perturbations

---

## What Is an Adversarial Attack?

**Adversarial attacks are deliberate, crafted perturbations**

An adversarial example is an input that has been slightly modified to cause a model to make a wrong prediction, while appearing essentially unchanged to a human.

Key properties of the perturbation:
- **Bounded**: typically constrained so the change is small (e.g., each pixel can shift by at most `ε`)
- **Targeted or untargeted**: either force a specific wrong class or just cause any misclassification
- **Worst-case**: the attack is optimized to maximally hurt the model

---

## Why Adversarial Robustness Matters

**Even if you don't anticipate adversaries**

Why this matters even if you don't care about adversaries:
- Models vulnerable to adversarial attacks have learned fragile, texture-dependent shortcuts rather than robust semantic features
- Adversarial robustness is correlated with better generalization under distribution shift

---

## FGSM: Fast Gradient Sign Method

**The simplest and most widely studied attack**

FGSM computes the gradient of the loss with respect to the input, then steps in the direction that increases the loss:

```
x_adv = x + ε · sign(∇_x L(f(x), y))
```

- `x`: original input image
- `y`: true label
- `L`: cross-entropy loss
- `ε` (epsilon): perturbation budget, e.g., 8/255 for L∞
- `sign(·)`: takes the sign of each gradient element, bounding the perturbation within `[-ε, ε]` per pixel

---

## FGSM Implementation in PyTorch

**Computing an adversarial example with FGSM**

```python
import torch
import torch.nn as nn
import torchvision.models as models
import torchvision.transforms as T
from PIL import Image

def fgsm_attack(model, x, y, epsilon):
    """
    x:       [B, C, H, W] float32 input, already normalized
    y:       [B] long integer labels
    epsilon: perturbation budget (same scale as x, e.g. 8/255)
    Returns: adversarial example clamped to valid image range
    """
    x_adv = x.clone().requires_grad_(True)

    loss = nn.CrossEntropyLoss()(model(x_adv), y)
    model.zero_grad()
    loss.backward()

    # Step in the sign of the gradient
    perturbation = epsilon * x_adv.grad.data.sign()
    x_adv = x_adv.detach() + perturbation

    # Clamp to valid normalized range (approximate; exact range depends on normalization)
    # For unnormalized [0,1] inputs:
    x_adv = torch.clamp(x_adv, 0.0, 1.0)
    return x_adv

# Example usage
model = models.resnet50(weights=models.ResNet50_Weights.IMAGENET1K_V2)
model.eval()

transform = T.Compose([T.Resize(224), T.CenterCrop(224), T.ToTensor()])
x = transform(Image.open("cat.jpg")).unsqueeze(0)   # [1, 3, 224, 224]
y = torch.tensor([281])                              # ImageNet "tabby cat"

epsilon = 8 / 255
x_adv = fgsm_attack(model, x, y, epsilon)

with torch.no_grad():
    pred_clean = model(x).argmax(1)
    pred_adv   = model(x_adv).argmax(1)
print(f"Clean prediction: {pred_clean.item()}")
print(f"Adversarial prediction: {pred_adv.item()}")
```

---

## PGD: Projected Gradient Descent

**Multi-step FGSM with projection back onto the constraint set**

PGD runs FGSM for `K` steps, projecting back to the `ε`-ball after each step:

```
x^{t+1} = Proj_{B(x, ε)} [ x^t + α · sign(∇_{x^t} L(f(x^t), y)) ]
```

- `α`: step size per iteration, typically `ε / K * 2`
- `Proj_{B(x, ε)}`: projects the perturbed image back into the `ε`-ball around the original `x`
- Starting from a random point inside the `ε`-ball (random restarts improve attack strength)

```python
def pgd_attack(model, x, y, epsilon, alpha, num_steps):
    # Start from random point inside epsilon-ball
    x_adv = x + torch.empty_like(x).uniform_(-epsilon, epsilon)
    x_adv = torch.clamp(x_adv, 0.0, 1.0).detach()

    for _ in range(num_steps):
        x_adv.requires_grad_(True)
        loss = nn.CrossEntropyLoss()(model(x_adv), y)
        loss.backward()

        with torch.no_grad():
            x_adv = x_adv + alpha * x_adv.grad.sign()
            # Project back into epsilon-ball around original x
            delta = torch.clamp(x_adv - x, -epsilon, epsilon)
            x_adv = torch.clamp(x + delta, 0.0, 1.0)

    return x_adv.detach()

# PGD-20 with epsilon=8/255
x_pgd = pgd_attack(model, x, y,
                   epsilon=8/255, alpha=2/255, num_steps=20)
```

---

## Evaluating Robustness with torchmetrics

**Measuring clean vs. adversarial accuracy systematically**

```python
import torch
from torchmetrics.classification import Accuracy

clean_acc = Accuracy(task="multiclass", num_classes=1000)
adv_acc   = Accuracy(task="multiclass", num_classes=1000)

model.eval()
for x_batch, y_batch in val_loader:
    with torch.no_grad():
        clean_preds = model(x_batch).argmax(1)
    clean_acc.update(clean_preds, y_batch)

    x_adv_batch = pgd_attack(model, x_batch, y_batch,
                              epsilon=4/255, alpha=1/255, num_steps=20)
    with torch.no_grad():
        adv_preds = model(x_adv_batch).argmax(1)
    adv_acc.update(adv_preds, y_batch)

print(f"Clean: {clean_acc.compute():.3f}")
print(f"PGD-20: {adv_acc.compute():.3f}")
```

---

## Threat Model Specification

**"Robustness" is meaningless without specifying the threat model**

A **threat model** defines the rules of the attack:

| Component                     | Example Choices                                               |
| ----------------------------- | ------------------------------------------------------------- |
| Perturbation type             | L∞ (max pixel change), L2 (total energy), spatial, semantic   |
| Perturbation budget (epsilon) | L∞ eps=8/255 is the CIFAR-10 standard; eps=4/255 for ImageNet |
| Attacker knowledge            | Whitebox (has model weights) vs. blackbox (only sees outputs) |
| Number of attack steps        | Single-step (FGSM) vs. multi-step (PGD)                       |

---

## Threat Model: Whitebox vs. Blackbox

**Attacker knowledge changes what attacks are possible**

**Whitebox attacks**: the attacker has full access to model architecture and weights; they can compute gradients directly. This is the hardest case.

**Blackbox attacks**: the attacker can only query the model for outputs. Harder to mount, but more realistic.

Robust accuracy is always relative to a threat model. Saying "our model is robust" without specifying the threat model is not a scientific claim.

---

## Choosing Which Attacks to Evaluate Against

**Common attack choices and what they tell you**

**FGSM (Fast Gradient Sign Method)**
- Single gradient step; very fast; relatively weak
- Useful for quick sanity checks; not sufficient as a final evaluation

**PGD (Projected Gradient Descent)**
- Multi-step FGSM; much stronger; the standard for L∞ robustness evaluation
- PGD-20 (20 steps) is a minimum; PGD-100 or AutoAttack for reliable results

---

## Attack Choices: AutoAttack and Corruption Benchmarks

**The current standard for rigorous evaluation**

**AutoAttack**
- An ensemble of four complementary attacks; no hyperparameters to tune
- Current standard for rigorous L∞ robustness evaluation on CIFAR and ImageNet
- If your model claims robustness, AutoAttack is what reviewers will expect to see

```python
# pip install autoattack
from autoattack import AutoAttack

adversary = AutoAttack(model, norm="Linf", eps=8/255, version="standard")
x_adv = adversary.run_standard_evaluation(x_batch, y_batch, bs=32)
```

**Common corruption benchmarks (CIFAR-10-C, ImageNet-C)**
- Test robustness to natural corruptions (blur, noise, weather, compression)
- Different from adversarial robustness; measures distribution shift, not worst-case attack

---

## Natural Corruption Evaluation

**Testing against distribution shift without adversaries**

```python
# ImageNet-C benchmark: 15 corruption types x 5 severity levels
# Each corruption is a separate dataset at /path/to/imagenet-c/<corruption>/<severity>/

import os
import torchvision.datasets as datasets

corruption_types = ["gaussian_noise", "shot_noise", "impulse_noise",
                    "defocus_blur", "glass_blur", "motion_blur", "zoom_blur",
                    "snow", "frost", "fog", "brightness",
                    "contrast", "elastic_transform", "pixelate", "jpeg_compression"]

results = {}
for corruption in corruption_types:
    for severity in range(1, 6):
        path = f"/data/imagenet-c/{corruption}/{severity}"
        dataset = datasets.ImageFolder(path, transform=eval_transform)
        loader = torch.utils.data.DataLoader(dataset, batch_size=64)
        acc = evaluate(model, loader)
        results[(corruption, severity)] = acc

# Mean Corruption Error (mCE) is the headline metric
```

---

## The Accuracy-Robustness Tradeoff

**Why making a model more robust usually hurts clean accuracy**

This is one of the most robust empirical findings in the robustness literature (observed across many architectures and datasets):

- Training with adversarial examples (adversarial training) increases robust accuracy
- But it almost always decreases clean accuracy by a few percentage points

Reference numbers from RobustBench (CIFAR-10, L∞, eps=8/255):
- Standard ResNet-18: clean ~94%, AutoAttack ~0%
- Adversarially trained WRN-70-16: clean ~92.4%, AutoAttack ~71.0%

---

## Why the Tradeoff Exists

**The cost of learning stable features**

Why does this happen?
- The model is forced to rely on features that are both useful for classification AND stable under perturbation
- Some features that boost clean accuracy (high-frequency texture patterns) are unstable under perturbation and must be down-weighted
- The model is also trained on "harder" examples, which takes capacity away from easy clean examples

This tradeoff is fundamental; no training method has fully eliminated it, though the gap has narrowed over time.

---

## Adversarial Training in Code

**Madry et al. (2018) PGD-based adversarial training**

```python
import torch
import torch.nn as nn
from torch.optim import SGD

model.train()
optimizer = SGD(model.parameters(), lr=0.1, momentum=0.9, weight_decay=5e-4)
criterion = nn.CrossEntropyLoss()

for x_batch, y_batch in train_loader:
    # Generate adversarial examples on the fly
    model.eval()                        # use eval BN stats for attack
    x_adv = pgd_attack(model, x_batch, y_batch,
                        epsilon=8/255, alpha=2/255, num_steps=10)
    model.train()

    # Train on adversarial examples
    optimizer.zero_grad()
    loss = criterion(model(x_adv), y_batch)
    loss.backward()
    optimizer.step()
```

Cost: each training step now runs `num_steps + 1` forward passes. Training is ~10x slower than standard training.

---

## Reporting Robustness Honestly

**Why cherry-picking attacks inflates your robustness claims**

A common mistake: evaluate only the weakest attack that the model happens to be robust against, then report that number.

Examples of inflated claims:
- Testing with FGSM only (weak single-step attack) when PGD or AutoAttack would give much lower numbers
- Using a very small epsilon budget that makes the perturbation invisible even to the model
- Evaluating at a specific IoU threshold where the model performs best
- Running only 10 attack steps and calling it PGD-10 when the community standard is PGD-50+

---

## Gradient Masking: A Hidden Pitfall

**When a defense appears to work but doesn't**

**Gradient masking / obfuscated gradients**: some defenses appear robust because they break the attacker's gradient signal, not because they're genuinely robust. Attacks like BPDA and AutoAttack are designed to bypass this.

The defense can be published and appear to work; then a stronger attack breaks it completely.

Diagnostic: if FGSM is stronger than PGD on your model, gradients are likely masked (PGD should never be weaker than FGSM on a well-behaved model).

---

## How to Report Robustness Honestly

**A checklist for rigorous robustness evaluation**

1. **Specify the threat model completely**: perturbation type, epsilon budget, attacker knowledge
2. **Use a strong, established attack**: AutoAttack for L∞; at minimum PGD with sufficient steps
3. **Report both clean and robust accuracy**: readers need both numbers to assess the tradeoff
4. **Verify gradients are not masked**: if your defense makes gradients vanish, test with gradient-free attacks as a sanity check
5. **Use the community-standard epsilon**: eps=8/255 for CIFAR-10, eps=4/255 for ImageNet (L∞)
6. **Report variance**: run multiple seeds; single-run numbers hide random variation

---

## Robustness Reporting: Final Steps

**Completing the checklist**

7. **Compare against known baselines**: results only make sense in context of what other methods achieve

---

## Robust Accuracy Under a Standard Threat Model

**The headline number you should report**

For image classification robustness:
- **CIFAR-10**: L∞, epsilon=8/255, AutoAttack = the reference evaluation
- **ImageNet**: L∞, epsilon=4/255, AutoAttack

For object detection robustness:
- Robustness metrics are less standardized; robust mAP under PGD perturbation is emerging

Why one number?
- It's easier to compare models when everyone uses the same threat model
- AutoAttack removes the hyperparameter tuning issue that makes custom attacks hard to reproduce
- RobustBench provides a public leaderboard; aim to situate your results there

---

## Clean vs. Robust Accuracy — Practical Implications

**When does each number matter?**

| Situation                                        | Metric That Matters More                                |
| ------------------------------------------------ | ------------------------------------------------------- |
| Deployed in a controlled, trusted environment    | Clean accuracy                                          |
| Deployed where users can submit arbitrary inputs | Robust accuracy                                         |
| Safety-critical systems (medical, autonomous)    | Both; neither alone is sufficient                       |
| Research: evaluating representation quality      | Robust accuracy is a better proxy for semantic features |

---

## Clean vs. Robust Accuracy: Diagnostic Value

**Robust accuracy as a quality signal**

A model with high clean accuracy but near-zero robust accuracy has likely learned shortcuts: statistical patterns that correlate with labels in the training set but don't reflect the semantic content of the image.

Robust accuracy is therefore a useful diagnostic tool even if you don't anticipate actual adversarial attacks in deployment.

---

## What We Covered

**Robustness evaluation in brief**

1. Clean accuracy and robust accuracy measure different things; high clean accuracy does not imply robustness
2. FGSM: `x_adv = x + ε · sign(∇_x L(f(x), y))` -- single-step attack; fast but weak
3. PGD: multi-step FGSM with projection; the standard evaluation attack
4. Always specify the threat model: perturbation type, budget (`ε`), and attacker knowledge
5. Use strong attacks (PGD with many steps, AutoAttack) for honest evaluation; weak attacks inflate claims
6. The accuracy-robustness tradeoff is real and fundamental; adversarial training helps but has a cost
7. Gradient masking makes models appear robust against gradient-based attacks without being genuinely robust
8. The headline number to report: robust accuracy under AutoAttack at the community-standard epsilon
