---
presentationID: 11zrz6jAvpg9NmV0E2G2OhLWlN5cMXvFiGPKpszqvmxw
title: VRAM Engineering
---

# VRAM Engineering

A systematic approach to understanding, calculating, and managing GPU memory: what goes where, how to budget it before you start, and how to apply the full toolkit of memory reduction techniques.

---

## The Three Memory Buckets

All VRAM usage during training falls into three categories:

**1. Parameter memory:** the model's weights. Fixed size, determined by architecture and dtype.

**2. Optimizer state memory:** what the optimizer needs to track for each parameter. Depends on optimizer choice.

**3. Activation memory:** intermediate values saved during the forward pass for use in backpropagation. Depends on batch size, sequence length, and model depth.

Each has a different size and different techniques to reduce it.

---

## Parameter Memory

The most predictable bucket.

```
parameter_bytes = num_parameters × bytes_per_dtype
```

| Dtype       | Bytes/param | 7B model | 13B model | 70B model |
| ----------- | ----------- | -------- | --------- | --------- |
| fp32        | 4           | 28 GB    | 52 GB     | 280 GB    |
| bf16 / fp16 | 2           | 14 GB    | 26 GB     | 140 GB    |
| int8        | 1           | 7 GB     | 13 GB     | 70 GB     |
| int4 / NF4  | 0.5         | 3.5 GB   | 6.5 GB    | 35 GB     |

During training in mixed precision, PyTorch maintains a fp32 master copy for numerical stability plus a bf16 working copy: effectively 6 bytes/param, or ~42 GB for 7B.

With LoRA, only adapter parameters need the fp32 master copy. Base model parameters stay frozen in bf16.

---

## Profiling Parameter Memory in PyTorch

---

## Profiling Parameter Memory in PyTorch

```python
import torch
from transformers import AutoModelForCausalLM

model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Meta-Llama-3-8B-Instruct",
    torch_dtype=torch.bfloat16,
    device_map="auto",
)

total_params = sum(p.numel() for p in model.parameters())
trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
param_gb = total_params * 2 / 1e9   # bf16 = 2 bytes

print(f"Total params:     {total_params / 1e9:.2f}B")
print(f"Trainable params: {trainable_params / 1e9:.2f}B")
print(f"Parameter memory: {param_gb:.1f} GB (bf16)")
print(f"VRAM allocated:   {torch.cuda.memory_allocated() / 1e9:.1f} GB")
```

---

## Optimizer State Memory

The optimizer stores additional per-parameter tensors.

**SGD with momentum:** 1 extra tensor per parameter in fp32.

**Adam:** 2 extra tensors per parameter (first moment `m` and second moment `v`) in fp32.

```
Adam states for 7B full fine-tuning:
  first moment:  7B × 4 bytes = 28 GB
  second moment: 7B × 4 bytes = 28 GB
  fp32 master weights:         28 GB
  bf16 working copy:           14 GB
  ─────────────────────────────────
  Total (before activations):  98 GB
```

That is why full fine-tuning a 7B model requires multi-GPU setups or aggressive memory techniques.

**With LoRA (r=16, all attention layers in Llama 3 8B, ~134M adapter params):**

```
Adam states: 134M × 4 bytes × 2 = ~1.0 GB
fp32 master: 134M × 4 bytes     = ~0.5 GB
bf16 base (frozen):             = 14.0 GB
─────────────────────────────────────────
Total (before activations):       ~15.5 GB
```

This is the core reason LoRA is so memory-efficient.

---

## Checking Optimizer State Memory

---

## Checking Optimizer State Memory

```python
from torch.optim import AdamW

optimizer = AdamW(model.parameters(), lr=2e-4)

# After one optimizer step, states are materialized
# Measure the footprint
def optimizer_memory_gb(opt):
    total_bytes = 0
    for group in opt.param_groups:
        for p in group['params']:
            if p in opt.state:
                state = opt.state[p]
                for k, v in state.items():
                    if isinstance(v, torch.Tensor):
                        total_bytes += v.numel() * v.element_size()
    return total_bytes / 1e9

# After a training step:
print(f"Optimizer states: {optimizer_memory_gb(optimizer):.2f} GB")
```

---

## Activation Memory

The most variable and often overlooked bucket.

During the forward pass, PyTorch saves intermediate activations at each layer for gradient computation during the backward pass.

**Rough formula per layer:**

```
activation_bytes ≈ batch_size × seq_len × hidden_dim × bytes_per_dtype × C
```

`C` accounts for all intermediate tensors in one transformer block (attention scores, intermediate projections, FFN intermediate). For a transformer block, `C ≈ 10-12`.

For Llama 3 8B (32 layers, hidden=4096), batch=4, seq=2048, bf16:

```
32 × 4 × 2048 × 4096 × 2 bytes × 11 ≈ 46 GB
```

Activation memory scales linearly with both batch size and sequence length. Attention specifically scales as `O(batch × heads × seq_len²)` without Flash Attention.

---

## Memory Profiling with PyTorch

The difference between `reserved` and `allocated` is internal fragmentation. Call `torch.cuda.empty_cache()` to release unused reserved memory back to the OS (useful between training phases).

---

## Memory Profiling with PyTorch

```python
import torch

# Reset peak stats before a run
torch.cuda.reset_peak_memory_stats()
torch.cuda.empty_cache()

# Run one training step
outputs = model(**batch)
loss = outputs.loss
loss.backward()

# Inspect
allocated_gb = torch.cuda.memory_allocated() / 1e9
peak_gb      = torch.cuda.max_memory_allocated() / 1e9
reserved_gb  = torch.cuda.memory_reserved() / 1e9

print(f"Currently allocated: {allocated_gb:.2f} GB")
print(f"Peak since reset:    {peak_gb:.2f} GB")
print(f"Reserved by PyTorch: {reserved_gb:.2f} GB")

# Full breakdown by allocation site
print(torch.cuda.memory_summary(device=0, abbreviated=True))
```

---

## Memory Snapshot Visualization

For a detailed timeline of every allocation, upload the snapshot to `https://pytorch.org/memory_viz` for an interactive stacked chart of every allocation over time. This 10-minute investment replaces hours of blind guessing.

---

## Memory Snapshot Visualization

```python
# Enable history tracking (incurs ~10% overhead)
torch.cuda.memory._record_memory_history(max_entries=100000)

# Run training steps
for step, batch in enumerate(dataloader):
    outputs = model(**batch)
    loss = outputs.loss / grad_accum_steps
    loss.backward()
    if (step + 1) % grad_accum_steps == 0:
        optimizer.step()
        optimizer.zero_grad()
    if step == 20:
        break  # short run for profiling

# Save snapshot
snapshot = torch.cuda.memory._snapshot()
import pickle
with open("mem_snapshot.pkl", "wb") as f:
    pickle.dump(snapshot, f)

torch.cuda.memory._record_memory_history(enabled=None)  # stop recording
```

---

## Building a Memory Budget

Before running a training job, estimate whether it will fit.

**Step-by-step for QLoRA on Llama 3 8B:**

```
1. Base model (NF4 4-bit):         8B × 0.5 bytes     = 4.0 GB
2. LoRA adapters (bf16):           134M × 2 bytes      = 0.27 GB
3. fp32 master weights (LoRA):     134M × 4 bytes      = 0.54 GB
4. Adam states (fp32, LoRA):       134M × 4 × 2 bytes  = 1.07 GB
5. Activations (batch=2, seq=2048, no checkpointing):
   32 × 2 × 2048 × 4096 × 2 × 11 ≈ 23 GB  ← this dominates
   With gradient checkpointing:    ≈ 2-3 GB
6. CUDA overhead:                  ~1.5 GB
──────────────────────────────────────────
Total with checkpointing:          ~10 GB  ← fits on a 16 GB T4
Total without checkpointing:       ~30 GB  ← does not fit
```

---

## Activation Checkpointing in Detail

Standard backprop: save all activations during forward pass, use during backward pass.

**Activation checkpointing** (gradient checkpointing): save only activations at "checkpoint" boundaries (transformer block inputs), discard all internal activations.

During backprop, when a discarded activation is needed, rerun the forward computation from the nearest checkpoint.

In `SFTTrainer` / `TrainingArguments`, just pass `gradient_checkpointing=True`. It also requires setting `model.config.use_cache = False` since KV caching and checkpointing are incompatible during training.

---

## Activation Checkpointing in Detail

```python
# Enable for the whole model
model.gradient_checkpointing_enable()

# Or per-module for custom control
from torch.utils.checkpoint import checkpoint

class CheckpointedBlock(nn.Module):
    def __init__(self, block):
        super().__init__()
        self.block = block

    def forward(self, x):
        return checkpoint(self.block, x, use_reentrant=False)
```

---

## Activation Checkpointing: Memory and Compute Impact

**Memory saved:** block-level checkpointing saves only the block input, recomputing all internal tensors.

```
Without checkpointing: activations ∝ batch × seq × hidden × layers × ~11
With checkpointing:    activations ∝ batch × seq × hidden × layers × ~1
Reduction: ~8-10x
```

**Compute cost:** one extra forward pass per backward pass, so roughly 33% more total compute.

The benefit scales with the factors that make activations large: long sequences, large batches, deep models. Checkpointing helps less when the model is small and activations are already a minor fraction of total VRAM.

**Interaction with Flash Attention:** Flash Attention handles the O(n²) attention score memory independently. Gradient checkpointing handles all other activations. They address different parts of the problem and compound when used together.

---

## ZeRO and CPU Offloading

When VRAM is truly exhausted, offload tensors to CPU RAM.

**DeepSpeed ZeRO** stages:
- **ZeRO-1**: shard optimizer states across GPUs
- **ZeRO-2**: also shard gradients
- **ZeRO-3**: also shard parameters

**ZeRO-Offload**: move optimizer states (and optionally parameters) to CPU RAM.

CPU offload of optimizer states for 7B full fine-tuning frees ~56 GB VRAM at the cost of PCIe transfer latency:

```
PCIe 4.0 x16 bandwidth: ~32 GB/s
Transfer 56 GB per step: ~1.75 s overhead
Per-step training time ~8 s → ~22% overhead: acceptable
Per-step training time ~2 s → ~88% overhead: painful
```

Use CPU offloading when it is the difference between fitting and not fitting.

---

## ZeRO and CPU Offloading

```python
# accelerate config with ZeRO-2 CPU offload (put in ~/.cache/huggingface/accelerate/default_config.yaml
# or pass directly via DeepSpeedPlugin)
from accelerate import Accelerator
from accelerate.utils import DeepSpeedPlugin

ds_plugin = DeepSpeedPlugin(
    zero_stage=2,
    offload_optimizer_device="cpu",   # Adam m/v tensors on CPU
    offload_param_device="none",
)
accelerator = Accelerator(deepspeed_plugin=ds_plugin)
```

---

## Effective Batch Size via Accumulation and Parallelism

**Effective batch size** = examples seen per weight update.

Three ways to scale it:

| Method                | Memory cost    | Time cost | Notes                              |
| --------------------- | -------------- | --------- | ---------------------------------- |
| Increase batch size   | Linear         | None      | Hits VRAM wall quickly             |
| Gradient accumulation | None           | Linear    | Steps = accum × micro-steps        |
| Data parallelism      | Per-GPU memory | None      | Synchronizes gradients across GPUs |

For a target effective batch of 64 on a single GPU with micro-batch 2:

```
accumulation_steps = 64 / 2 = 32  → 32 forward/backward passes per optimizer step
```

Larger batches improve training stability and allow higher learning rates. Linear scaling heuristic: multiply LR by `new_batch / old_batch` when doubling batch size. There is a ceiling: very large batches can hurt generalization via the sharp minima effect. For fine-tuning, effective batch sizes of 16-64 are typical.

---

## Effective Batch Size via Accumulation and Parallelism

```python
train_args = SFTConfig(
    per_device_train_batch_size=2,
    gradient_accumulation_steps=32,   # effective batch = 64
    ...
)
```

---

## Worked Example: 7B Model on a T4 (16 GB)

Target: fine-tune Llama 3 8B on a T4 GPU with 16 GB VRAM.

**Without any memory techniques:**
- bf16 working weights: 16 GB (fills the entire GPU before training starts)
- Optimizer states, activations: impossible

**With QLoRA, gradient checkpointing, batch=2, seq=2048:**

| Component                               | Size        |
| --------------------------------------- | ----------- |
| Base model (NF4 quantized)              | ~4.5 GB     |
| LoRA adapters (bf16)                    | ~0.27 GB    |
| Adam optimizer states (fp32, LoRA only) | ~1.1 GB     |
| Activations (with checkpointing)        | ~2.5 GB     |
| CUDA + framework overhead               | ~1.5 GB     |
| **Total**                               | **~9.9 GB** |

Leaves ~6 GB headroom. Effective batch of 16 via 8 gradient accumulation steps.

---

## Full VRAM Engineering Checklist

```
Before training:
  □ Estimate memory budget (params + optimizer + activations + overhead)
  □ Pick dtype: bf16 on Ampere+, fp16 with scaler on older GPUs
  □ Choose quantization: NF4 4-bit if budget is tight
  □ Set LoRA r and target modules: r=16, all attention for most tasks
  □ Enable Flash Attention (attn_implementation=“flash_attention_2”)
  □ Set gradient_checkpointing=True and model.config.use_cache=False
  □ Set max_seq_length to the minimum you need
  □ Set per_device_train_batch_size=1 or 2, accumulate the rest

During training:
  □ Watch nvidia-smi or torch.cuda.memory_allocated() after first step
  □ If OOM: halve batch size, then reduce seq_len, then increase quantization
  □ Profile with memory snapshot if cause is unclear
```

---

## Key Takeaways

- VRAM usage = parameters + optimizer states + activations; each has different drivers and different fixes
- With Adam full fine-tuning, optimizer states alone are 2x the parameter count in fp32; for 7B that is 56 GB
- LoRA reduces optimizer states to only the adapter parameters; ~1 GB for r=16 on Llama 3 8B vs. 56 GB for full Adam
- Activation memory scales as `batch × seq × hidden × layers × ~11`; gradient checkpointing reduces it ~8-10x at a 33% compute cost
- Use `torch.cuda.memory_summary()` and the PyTorch memory snapshot tool to profile before optimizing blind
- ZeRO-2 CPU offload of optimizer states is worth it when it is the difference between fitting and not fitting; PCIe latency makes it costly at short per-step times
- For 7B on 16 GB: QLoRA NF4 + LoRA r=16 + gradient checkpointing + Flash Attention fits with seq=2048, batch=2, ~10 GB total
