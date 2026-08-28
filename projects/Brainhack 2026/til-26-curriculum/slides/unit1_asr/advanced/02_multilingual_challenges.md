---
presentationID: 1aRapxGQVfC1-D4i9uqIHOYNmbISOKFwoZalgRZnM1Kk
title: Multilingual Challenges in ASR
---

# Multilingual Challenges in ASR

Why multilingual speech recognition is harder than it looks.

---

## The Tokenization Problem

**Subword tokenizers were designed with Latin script in mind**

Standard approach (BPE, SentencePiece, WordPiece):
- Build a vocabulary from frequent character n-grams in training data
- Works well for languages with word boundaries and a small alphabet

Problems for other scripts:

| Script Family                    | Languages               | Key Issues                                                                |
| -------------------------------- | ----------------------- | ------------------------------------------------------------------------- |
| CJK (Chinese, Japanese, Korean)  | ~1.5B speakers          | No word spaces; each character is a morpheme; large character set (~50k+) |
| Arabic / Hebrew                  | ~500M speakers          | Right-to-left, highly inflected, vowels often omitted in written form     |
| Devanagari                       | Hindi, Sanskrit, Nepali | Akshara (syllabic unit) doesn't map cleanly to byte-pair                  |
| Agglutinative (Turkish, Finnish) | Hundreds of millions    | Single words encode what English expresses in a whole phrase              |

---

## The Tokenization Problem: Impact on ASR

- A BPE tokenizer trained on English data will fragment non-Latin words into bytes, making the output sequence much longer and degrading sequence-to-sequence alignment

---

## Tokenization Solutions

**Approaches for multilingual tokenization**

**Sentencepiece with a large shared vocabulary**
- Train BPE/unigram on a multilingual corpus with temperature-based sampling
- Sample languages proportionally to prevent high-resource languages from dominating
- Whisper uses this approach with a ~51k token vocabulary covering 99 languages

**Character-level models**
- Sidestep tokenization entirely; output individual characters
- Longer output sequences, but no coverage issues
- Common for CJK scripts where characters are meaningful units

---

## Tokenization Solutions: Language-Specific and Byte-Level

**Language-specific tokenizers with a shared model**
- Per-language vocabulary heads, shared encoder
- Clean solution but requires knowing the language at inference time

**Byte-level fallback**
- Represent any Unicode character as a sequence of UTF-8 bytes
- Guarantees full coverage; poor compression ratio for non-Latin text

---

## Script Normalization in Code

**Pre-processing text before computing WER requires careful normalization**

ASR output for non-Latin scripts often requires script-level normalization before evaluation. Inconsistencies in diacritics, ligatures, or punctuation inflate WER artificially.

Failing to normalize before WER computation is a common source of artificially high error rates.

---

## Script Normalization in Code

```python
import unicodedata
import re

def normalize_arabic(text: str) -> str:
    """Remove diacritics (tashkeel) and normalize Arabic text."""
    # Diacritics are in Unicode range U+064B to U+065F
    text = re.sub(r"[ً-ٟ]", "", text)
    # Normalize alef variants to bare alef
    text = re.sub(r"[آأإ]", "ا", text)
    # Remove tatweel (elongation character)
    text = re.sub(r"ـ", "", text)
    return text.strip()

def normalize_unicode(text: str, form: str = "NFC") -> str:
    """Normalize Unicode composition (important for Devanagari, Arabic)."""
    return unicodedata.normalize(form, text)

# Whisper may output fully-diacritized Arabic; references often lack diacritics
ref = normalize_arabic(normalize_unicode(reference_text))
hyp = normalize_arabic(normalize_unicode(hypothesis_text))
```

---

## Language Identification

**Implicit vs. explicit LangID in multilingual ASR**

Two design philosophies:

**Explicit LangID (predict-then-transcribe)**
- A separate classifier identifies the language first
- The ASR model is conditioned on the predicted language
- Pros: interpretable, easy to fine-tune per language
- Cons: LangID errors cascade into transcription errors; latency from two-stage pipeline

---

## Language Identification Pipeline in Code

**Building a two-stage LangID + ASR pipeline**

---

## Language Identification Pipeline in Code

```python
from transformers import pipeline
import torch

# Stage 1: Language identification
# facebook/mms-lid-126 covers 126 languages
lang_classifier = pipeline(
    "audio-classification",
    model="facebook/mms-lid-126",
    device="cuda"
)

# Stage 2: Language-conditioned ASR
asr = pipeline(
    "automatic-speech-recognition",
    model="openai/whisper-large-v3",
    device="cuda"
)

def transcribe_with_langid(audio_path: str) -> dict:
    # Identify language from first 3 seconds
    lang_result = lang_classifier(audio_path)
    predicted_lang = lang_result[0]["label"]  # e.g., "cmn" for Mandarin
    confidence = lang_result[0]["score"]

    # Map MMS language codes to Whisper language names
    lang_map = {"cmn": "chinese", "ara": "arabic", "hin": "hindi"}
    whisper_lang = lang_map.get(predicted_lang, "english")

    # Transcribe with forced language
    transcript = asr(
        audio_path,
        generate_kwargs={"language": whisper_lang}
    )
    return {
        "language": predicted_lang,
        "confidence": confidence,
        "text": transcript["text"]
    }
```

---

## Language Identification: Implicit and Hybrid Approaches

**Implicit LangID (the model handles it internally)**
- A single model handles all languages without being told which one
- Whisper uses this: `<|language_token|>` can be forced at inference or predicted automatically
- Pros: end-to-end, no separate LangID step
- Cons: the model may confidently transcribe the wrong language in ambiguous cases

**Hybrid approach**
- Predict language for the first few seconds, then condition the decoder for the remainder
- Used in some streaming systems where LangID must be fast

---

## Language Identification: Implicit and Hybrid Approaches

```python
from transformers import AutoModelForSpeechSeq2Seq, AutoProcessor
import torch

# Let Whisper predict the language automatically (no forced language token)
processor = AutoProcessor.from_pretrained("openai/whisper-large-v3")
model = AutoModelForSpeechSeq2Seq.from_pretrained(
    "openai/whisper-large-v3", torch_dtype=torch.float16
).to("cuda")

inputs = processor(audio_array, return_tensors="pt",
                   sampling_rate=16000).to("cuda")

# forced_decoder_ids=None lets the model predict the language token
predicted_ids = model.generate(
    **inputs,
    forced_decoder_ids=None
)
decoded = processor.batch_decode(predicted_ids, skip_special_tokens=False)
# Output includes language token: "<|zh|><|transcribe|> 你好世界"
```

---

## Transfer Learning Across Language Families

**What actually transfers, and what doesn't**

**What transfers well**
- Acoustic feature extraction: phoneme-level patterns have similarities across languages (voiced/unvoiced stops, fricatives, nasals appear in many languages)
- Self-supervised representations (wav2vec, HuBERT) trained on many languages capture broad acoustic universals
- Encoder weights generalize much better than decoder weights across languages

**What transfers poorly**
- Decoder / language model component: vocabulary and grammar are language-specific
- Prosody and tone: tonal languages (Mandarin, Vietnamese, Thai) use pitch as a phoneme; non-tonal pretrained models lack tonal feature detectors
- Script-specific decoding: a model pretrained only on Latin-script data has an underdeveloped embedding space for CJK tokens

---

## Zero-Shot Cross-Lingual Transfer Mechanics

**Why shared representations work across language families**

XLSR-53 (`facebook/wav2vec2-large-xlsr-53`) is trained jointly on 53 languages. The contrastive pretraining objective does not use text at all, so the learned representations are language-agnostic at the phoneme level.

The encoder learned a universal acoustic space; only the CTC projection head needs to learn the new language's output symbols.

---

## Zero-Shot Cross-Lingual Transfer Mechanics

```python
from transformers import Wav2Vec2ForCTC, Wav2Vec2Processor

# Base model pretrained on 53 languages
model_id = "facebook/wav2vec2-large-xlsr-53"
processor = Wav2Vec2Processor.from_pretrained(model_id)
model = Wav2Vec2ForCTC.from_pretrained(
    model_id,
    vocab_size=len(processor.tokenizer),  # target language vocab
    ignore_mismatched_sizes=True           # replace the CTC head
)

# Critical: freeze the CNN feature extractor
# It already extracts good acoustic features; fine-tuning it on small data overfits
model.freeze_feature_encoder()

# Use a lower learning rate for the Transformer layers vs. the new CTC head
optimizer_grouped_params = [
    {"params": model.wav2vec2.parameters(), "lr": 1e-5},
    {"params": model.lm_head.parameters(),  "lr": 1e-4},
]
```

---

## Transfer Learning: Practical Implications

**Practical implication**
- When fine-tuning a multilingual model on a new language: freeze the encoder (or use a low learning rate), fine-tune the decoder more aggressively
- For tonal languages: pretraining on other tonal languages helps significantly
- MMS (`facebook/mms-1b-all`) trains a single adapter per language on top of a shared backbone, reducing per-language storage to a few MB

---

## Low-Resource Languages

**Data scarcity is the dominant problem**

Typical data availability landscape:
- English ASR: thousands to hundreds of thousands of hours
- Major world languages (Spanish, Mandarin, French): hundreds of hours
- Low-resource languages: < 10 hours, sometimes < 1 hour

**Mitigation strategies**

*Self-supervised pretraining (SSL)*
- Pretrain on unlabeled audio; fine-tune on small labeled set
- XLSR-53 showed you can get competitive ASR with 10 minutes of labeled data

---

## Loading Common Voice for Low-Resource Fine-Tuning

**The Common Voice dataset spans 100+ languages via HuggingFace**

---

## Loading Common Voice for Low-Resource Fine-Tuning

```python
from datasets import load_dataset, Audio

# Load Common Voice for a low-resource language (e.g., Maltese: "mt")
dataset = load_dataset(
    "mozilla-foundation/common_voice_13_0",
    "mt",            # language code
    split="train",
    trust_remote_code=True
)

# Cast audio column to 16 kHz automatically during iteration
dataset = dataset.cast_column("audio", Audio(sampling_rate=16000))

# Inspect a sample
sample = dataset[0]
print(sample["audio"]["sampling_rate"])  # 16000
print(sample["sentence"])               # reference transcript
print(sample["audio"]["array"].shape)   # (n_samples,)

# FLEURS is another clean benchmark: google/fleurs
fleurs = load_dataset("google/fleurs", "mt_mt", split="test")
```

---

## Low-Resource Mitigation Strategies

*Data augmentation*
- SpecAugment: mask time and frequency bands in the spectrogram
- Speed perturbation: shift audio to +/- 10% speed to simulate speaker variation
- Room impulse response (RIR) convolution: simulate different acoustic environments

*Cross-lingual transfer*
- Fine-tune a multilingual pretrained model rather than training from scratch
- Using related languages in training data ("language neighbor" sampling)

*Semi-supervised learning*
- Use a strong model to pseudo-label unlabeled audio, then train on those pseudo-labels
- Iterative self-training can close a significant gap

---

## SpecAugment in Code

**Masking time and frequency bands during training**

SpecAugment is one of the most impactful regularization techniques for ASR, especially in low-resource settings.

---

## SpecAugment in Code

```python
import torchaudio.transforms as T
import torch

def apply_spec_augment(
    log_mel: torch.Tensor,
    freq_mask_param: int = 27,
    time_mask_param: int = 100,
    n_freq_masks: int = 2,
    n_time_masks: int = 2
) -> torch.Tensor:
    """
    log_mel: [1, n_mels, time_frames]
    Applies SpecAugment in-place.
    """
    freq_masker = T.FrequencyMasking(freq_mask_param=freq_mask_param)
    time_masker = T.TimeMasking(time_mask_param=time_mask_param)

    for _ in range(n_freq_masks):
        log_mel = freq_masker(log_mel)
    for _ in range(n_time_masks):
        log_mel = time_masker(log_mel)
    return log_mel

# During training, apply augmentation to each batch
augmented = apply_spec_augment(log_mel_batch)
```

---

## Data Imbalance in Multilingual Training

**High-resource languages dominate gradient updates without explicit balancing**

If you train on a mixture of English (10,000 hours) and Swahili (10 hours), the model effectively trains only on English. Two standard mitigations:

**Temperature-based sampling**: sample language `l` with probability proportional to `p_l^{1/T}` where `T > 1` oversamples low-resource languages.

**Gradient accumulation per language**: accumulate gradients separately per language batch and average before the optimizer step, preventing any single language from dominating.

---

## Data Imbalance in Multilingual Training

```python
import numpy as np

def temperature_sample_weights(
    language_sizes: dict[str, int], temperature: float = 2.0
) -> dict[str, float]:
    """
    language_sizes: {"en": 10000, "sw": 10, "mt": 50, ...}
    Returns normalized sampling weights at the given temperature.
    """
    sizes = np.array(list(language_sizes.values()), dtype=float)
    # Raise to 1/T before normalizing
    weights = sizes ** (1.0 / temperature)
    weights = weights / weights.sum()
    return dict(zip(language_sizes.keys(), weights))

sizes = {"en": 10000, "sw": 10, "mt": 50}
weights = temperature_sample_weights(sizes, temperature=2.0)
# en: ~0.51, sw: ~0.10, mt: ~0.19  (vs raw: en ~99.4%)
```

---

## Low-Resource Evaluation Pitfalls

**Metrics and evaluation traps in low-resource settings**

- Standard WER (word error rate) is unreliable when test sets are tiny (< 1 hour)
  - High variance: a few long utterances can dominate the metric
  - Use bootstrap confidence intervals; report standard deviation across runs

- Morphologically rich languages inflate WER: one word error can cascade across many surface forms
  - Prefer **character error rate (CER)** for CJK; morpheme-level metrics for Turkish/Finnish/Arabic

- Beware of data contamination: some "low-resource" languages have web-scraped training data that overlaps with test benchmarks
  - The Common Voice and FLEURS benchmarks are cleaner but still not perfectly controlled

- Domain mismatch: most low-resource corpora are read speech; performance on conversational or spontaneous speech is typically much worse

---

## Computing WER and CER for Evaluation

**Using jiwer for robust metric computation**

---

## Computing WER and CER for Evaluation

```python
from jiwer import wer, cer, compute_measures
import numpy as np

references = [
    "the quick brown fox",
    "she sells sea shells",
]
hypotheses = [
    "the quick brown box",
    "she sells sea shells by the sea shore",
]

# Basic WER and CER
print(f"WER: {wer(references, hypotheses):.4f}")
print(f"CER: {cer(references, hypotheses):.4f}")

# Detailed breakdown: substitutions, deletions, insertions
measures = compute_measures(references, hypotheses)
print(f"Substitutions: {measures['substitutions']}")
print(f"Deletions:     {measures['deletions']}")
print(f"Insertions:    {measures['insertions']}")

# Bootstrap confidence interval (manual implementation)
def bootstrap_wer(refs, hyps, n_bootstrap=1000):
    n = len(refs)
    scores = []
    for _ in range(n_bootstrap):
        idx = np.random.choice(n, n, replace=True)
        r = [refs[i] for i in idx]
        h = [hyps[i] for i in idx]
        scores.append(wer(r, h))
    return np.percentile(scores, [2.5, 97.5])

ci = bootstrap_wer(references, hypotheses)
print(f"95% CI: [{ci[0]:.4f}, {ci[1]:.4f}]")
```

---

## Code-Switching

**When speakers switch languages mid-utterance**

Code-switching (CS) is natural in multilingual communities:
- "I'm going to la tienda después de work." (English-Spanish-English)
- "我昨天 went to the 超市." (Mandarin-English-Mandarin)

Why it's hard for ASR:
- Most models are trained on monolingual data; the model sees the switch as noise
- Tokenizers may not cover both scripts efficiently in the same vocabulary
- Language model component has strong priors for a single language

Evaluation metric: **mixed error rate (MER)** or CS-specific WER that accounts for both languages

---

## Code-Switching — Approaches

**How to build CS-aware models**

**Multilingual fine-tuning with CS data**
- Collect or synthesize code-switched training utterances
- Fine-tune a multilingual model; the model learns to handle mid-utterance switches
- Data is scarce; SEAME (Mandarin-English) and Miami Bangor are the most studied corpora

**Language-pair-specific models**
- Train a bilingual model on the specific pair (e.g., EN-ZH)
- Better than a general multilingual model for that pair; doesn't generalize

---

## Code-Switching — LLM-Based and Acoustic Approaches

**LLM-based decoding**
- Use a large language model to post-edit or rerank ASR hypotheses
- The LM has seen code-switched text and can correct implausible monolingual sequences

**Acoustic-level signals**
- Segment the audio into monolingual chunks before ASR (risky: segment boundaries are ambiguous)
- Some models use acoustic embeddings to predict a per-frame language label in parallel with transcription

---

## MMS: Massively Multilingual Speech

**Facebook's MMS model covers 1,100+ languages**

MMS (`facebook/mms-1b-all`) uses language-specific adapter layers on top of a shared wav2vec 2.0 backbone. Each adapter is ~1 MB; the backbone is shared.

MMS is the practical starting point for any language not covered by Whisper's 99-language set.

---

## MMS: Massively Multilingual Speech

```python
from transformers import Wav2Vec2ForCTC, AutoProcessor
import torch

# MMS with 1,100 languages
processor = AutoProcessor.from_pretrained("facebook/mms-1b-all")
model = Wav2Vec2ForCTC.from_pretrained("facebook/mms-1b-all")

# Set the target language adapter (ISO 639-3 code)
processor.tokenizer.set_target_lang("swh")  # Swahili
model.load_adapter("swh")

# Run inference
inputs = processor(
    audio_array,
    sampling_rate=16000,
    return_tensors="pt"
)
with torch.no_grad():
    outputs = model(**inputs).logits

ids = torch.argmax(outputs, dim=-1)
transcription = processor.decode(ids[0])
print(transcription)
```

---

## SeamlessM4T: Speech-to-Speech Across 100+ Languages

**A unified model for speech translation and transcription**

SeamlessM4T (`facebook/seamless-m4t-v2-large`) handles speech-to-text (S2TT), speech-to-speech (S2ST), text-to-speech (TTS), and text-to-text (MT) in a single architecture.

---

## SeamlessM4T: Speech-to-Speech Across 100+ Languages

```python
from transformers import AutoProcessor, SeamlessM4Tv2Model
import torchaudio

processor = AutoProcessor.from_pretrained("facebook/seamless-m4t-v2-large")
model = SeamlessM4Tv2Model.from_pretrained("facebook/seamless-m4t-v2-large")

waveform, sr = torchaudio.load("speech_arabic.wav")

# Speech-to-text transcription in Arabic
inputs = processor(audios=waveform, return_tensors="pt", sampling_rate=sr)
output_tokens = model.generate(
    **inputs,
    tgt_lang="arb",   # target language: Modern Standard Arabic
    generate_speech=False  # text output only
)
transcript = processor.decode(output_tokens[0], skip_special_tokens=True)

# Speech-to-text translation to English
output_tokens_en = model.generate(
    **inputs,
    tgt_lang="eng",
    generate_speech=False
)
translation = processor.decode(output_tokens_en[0], skip_special_tokens=True)
```

---

## A Practical Checklist for Multilingual ASR

**What to consider when building a multilingual system**

1. **Tokenizer coverage**: does your vocabulary efficiently represent all target scripts?
2. **Data balance**: are high-resource languages drowning out low-resource ones in training?
3. **Evaluation metric**: is WER appropriate, or should you use CER or morpheme-level metrics?
4. **Language identification**: explicit prompt or let the model predict? How do you handle errors?
5. **Transfer strategy**: which components of the pretrained model to freeze vs. fine-tune?
6. **Code-switching**: do your test utterances contain mixed-language speech?

---

## A Practical Checklist: Final Item

7. **Test set integrity**: check for contamination with training data, especially for web-scraped corpora

---

## What We Covered

**Multilingual ASR is a collection of distinct, interacting problems**

- Tokenization: subword methods must cover diverse scripts; solutions include large shared vocabularies, character-level, and byte-level fallbacks
- Script normalization: Arabic diacritics removal and Unicode NFC normalization must precede WER computation
- Language identification: explicit two-stage pipeline with `facebook/mms-lid-126` vs. Whisper's implicit prediction
- Transfer learning: freeze the CNN encoder, use lower LR for Transformer layers, replace the CTC head; `facebook/wav2vec2-large-xlsr-53` is the standard starting point
- Data imbalance: temperature-based sampling with `T = 2` substantially rebalances multilingual training mixtures
- Low-resource mitigation: SSL pretraining + SpecAugment + semi-supervised learning; Common Voice and FLEURS for benchmarking
- Code-switching: requires CS-aware training data (SEAME, Miami Bangor) and evaluation metrics
- MMS (`facebook/mms-1b-all`): 1,100+ languages via language adapters; practical fallback for languages outside Whisper's coverage
