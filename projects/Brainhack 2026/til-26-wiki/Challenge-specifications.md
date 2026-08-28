This section gives detailed specifications of each of the four challenges.

<details>

<summary><b>Contents</b></summary>

1. [Overview](#overview)
   1. [Score breakdown](#score-breakdown)
2. [ASR](#asr)
   1. [Track variations](#track-variations)
   2. [Scoring](#scoring)
   3. [Input](#input)
   4. [Output](#output)
3. [CV](#cv)
   1. [Target list](#target-list)
   2. [Track variations](#track-variations-1)
   3. [Scoring](#scoring-1)
   4. [Input](#input-1)
   5. [Output](#output-1)
4. [Noise](#noise)
   1. [Track Variations](#track-variations-2)
   2. [Scoring](#scoring-2)
   3. [Input](#input-2)
   4. [Output](#output-2)
5. [NLP](#nlp)
   1. [Fictional world context](#fictional-world-context)
   2. [Training data](#training-data)
   3. [Track variations](#track-variations-3)
   4. [Scoring](#scoring-3)
   5. [Corpus Setup](#corpus-setup)
   6. [Input](#input-3)
   7. [Output](#output-3)
6. [AE](#ae)
   1. [Gameplay overview](#gameplay-overview)
   2. [Notes](#notes)
   3. [Track variations](#track-variations-4)
   4. [Scoring](#scoring-4)
   5. [Input](#input-4)
   6. [Output](#output-4)

</details>

## Overview

Your TIL-AI 2026 mission consists of four challenges across distinct fields of study in artificial intelligence: **automatic speech recognition (ASR)**, **computer vision (CV)**, **natural language processing (NLP)**, and **autonomous exploration (AE)**.

This document provides the technical specifications for the four challenges. It aims to rigorously define the design and requirements, not to be a first-time guide to the TIL-AI mission for the uninitiated. For a non-technical introduction, take a look at the [Opening Ceremony slides](https://drive.google.com/file/d/1P-2X-fNWr_qwYbElfMFdNCau9nLXrYOd/).

A copy of the input and output formats is provided in the `README.md` file in each model's directory in the [`til-ai/til-26`](https://github.com/til-ai/til-26) template repository. These copies are provided for your convenience; though if there is a conflict in meaning between the copy in `README.md` and the specifications in this document, this document shall take precedence.

### Score breakdown

Your overall score is calculated by a weighted sum of the scores for each challenge. The weights are as follows:

| Challenge | Weight |
| --------- | ------ |
| ASR       | 20%    |
| CV        | 20%    |
| NLP       | 20%    |
| AE        | 40%    |

Each challenge's score is calculated by a weighted sum of accuracy/reward and inference speed score:

| Challenge | Accuracy/reward weight | Speed score weight |
| --------- | ---------------------- | ------------------ |
| ASR       | 75%                    | 25%                |
| CV        | 75%                    | 25%                |
| NLP       | 75%                    | 25%                |
| AE        | 75%                    | 25%                |

The speed score is calculated by:

```math
1-\frac{\min(t_{\text{elapsed}},t_{\max})}{t_{\max}}
```

where $t_{elapsed}$ is the time taken for your model to complete inference on the whole test set, and $t_{max}$ is the inference duration beyond which your model gets zero speed score. For Qualifiers, $t_{max}$ is 30 minutes.

In short, the less time your model takes to generate its predictions, the better your speed score. A perfect score requires instantaneous inference.


## ASR

Your automatic speech recognition challenge is to transcribe a noisy recording of speech. Given an audio file, your model is expected to produce a text transcript of what was spoken.

In each audio file, there is only one speaker. Note that many of the words used within each audio file are not necessarily normal dictionary words. The generated audio is all set in the fictional world of the [NLP RAG corpus](#nlp), which means it will include various slang terms and jargon relevant to that world.

### Track variations
For the Novice track, all speech will be in English, but the speaker may speak with a variety of accents. 

For the Advanced track, all speech will be in one of four languages in roughly even proportion across the dataset:
1. English
2. Malay
3. Tamil
4. Chinese

Fictional slang terms will tend to be, but not necessarily, be in English, regardless of the language of the rest of the audio. Thus, non-English language clips are primarily non-English, but with some English words scattered in. In addition, the input audio for the Advanced track will contain more noise than that for Novice.

### Scoring

The accuracy score of your ASR model on English, Tamil, and Malay, is calculated by $\max(0, 1 - WER)$, where WER is the word error rate as calculated using [JiWER](https://jitsi.github.io/jiwer/). Before computing the WER between predicted and ground truth transcripts, the following transforms are applied to the predicted transcript:

```python
jiwer.Compose([
    jiwer.ToLowerCase(),
    jiwer.SubstituteRegexes({"-": " ", "—": " ", "–": " "}),
    jiwer.RemoveMultipleSpaces(),
    jiwer.RemovePunctuation(),
    jiwer.Strip(),
    jiwer.ReduceToListOfListOfWords(),
])
```

As for Chinese, it is calculated by $\max(0,1-CER)$, where CER is the character error rate as calculated using [JiWER](https://jitsi.github.io/jiwer/). Similar to the other languages, the following transforms are applied to Chinese transcripts:

```python
jiwer.Compose([
    jiwer.ToLowerCase(),
    jiwer.SubstituteRegexes({"-": "", "—": "", "–": ""}),
    jiwer.RemoveWhiteSpace(replace_by_space=False),
    jiwer.RemovePunctuation(),
    jiwer.ReduceToListOfListOfChars(),
])
```

The individual error rate of each language is then averaged to get your final accuracy score. 

<details>

<summary>Input and output formats</summary>

### Input

The input is sent via a POST request to the `/asr` route on port `5001`. It is a JSON document structured as such:

```JSON
{
  "instances": [
    {
      "key": 0,
      "b64": "BASE64_ENCODED_AUDIO"
    },
    ...
  ]
}
```

The `b64` key of each object in the `instances` list contains the base64-encoded bytes of the input audio in WAV format. The length of the `instances` list is variable.

### Output

Your route handler function must return a `dict` with this structure:

```Python
{
    "predictions": [
        "Predicted transcript one.",
        "Predicted transcript two.",
        ...
    ]
}
```

where each string in `predictions` is the predicted ASR transcription for the corresponding audio file.

The $k$-th element of `predictions` must be the prediction corresponding to the $k$-th element of `instances` for all $1 \le k \le n$, where n is the number of input instances. The length of `predictions` must equal that of `instances`.
</details>

## CV

Your CV challenge is to detect and classify objects in an image. Given an image, your model is expected to produce the bounding box and predicted category of every occurrence of an object belonging to a category in the [target list](#target-list). Each scene may contain zero or more targets.

Your output is expected to contain the following values:
* $(l, t)$: The coordinates in pixels of the top-left corner of the predicted bounding box. $l$ is the horizontal coordinate and $t$ Is the vertical.
* $(w, h)$: The width and height in pixels of the predicted bounding box
* `category_id`: The index of the predicted category in the target list

All bounding box coordinates should be zero-indexed; that is, $(x, y) = (0, 0)$ means the top-left corner of the bounding box is at the top-left corner of the image.

NOTE: this is known as an LTWH bounding box. Various CV systems (e.g. YOLO), output subtly different bounding boxes (e.g. XYWH), that need to be converted into this format. e.g.

```python
from ultralytics.utils.ops import xywh2ltwh
from ultralytics import YOLO
model = YOLO("./best.pt")
result = model.predict(...)
boxes = xywh2ltwh(result.boxes.xywh.cpu().numpy()).tolist()
```

### Target list
| Category index | Object type         |
| -------------- | ------------------- |
| 0              | cargo aircraft      |
| 1              | commercial aircraft |
| 2              | drone               |
| 3              | fighter jet         |
| 4              | fighter plane       |
| 5              | helicopter          |
| 6              | light aircraft      |
| 7              | missile             |
| 8              | truck               |
| 9              | car                 |
| 10             | tank                |
| 11             | bus                 |
| 12             | van                 |
| 13             | cargo ship          |
| 14             | yacht               |
| 15             | cruise ship         |
| 16             | warship             |
| 17             | sailboat            |

### Track variations

The input images for the Advanced track will contain more noise than those for the Novice track. The targets in the Advanced track input images will also be smaller in size than those for the Novice track.

### Scoring

The accuracy score is calculated by mean average precision over IoU thresholds ranging from 0.5 to 0.95 with a stride of 0.05, otherwise known as mAP@.5:.05:.95. See [here](https://www.ultralytics.com/glossary/mean-average-precision-map) for details.

<details>

<summary>Input and output formats</summary>

### Input

The input is sent via a POST request to the `/cv` route on port 5002. It is a JSON document structured as such:

```JSON
{
  "instances": [
    {
      "key": 0,
      "b64": "BASE64_ENCODED_IMAGE"
    },
    ...
  ]
}
```

The `b64` key of each object in the `instances` list contains the base64-encoded bytes of the input image in JPEG format. The length of the `instances` list is variable.

### Output

Your route handler function must return a `dict` with this structure:

```Python
{
    "predictions": [
        [
            {
                "bbox": [l, t, w, h],
                "category_id": category_id
            },
            ...
        ],
        ...
    ]
}
```

where `l`, `t`, `w`, `h`, and `category_id` are defined as above.

If your model detects no objects in a scene, your handler should output an empty list for that scene.

The $k$-th element of `predictions` must be the prediction corresponding to the $k$-th element of `instances` for all $1 \le k \le n$, where n is the number of input instances. The length of `predictions` must equal that of `instances`.

</details>

## Noise

An additional component to the CV challenge is for your team to adversarially noise images for your competitors to use as inputs to their CV models.

During the Finals, when an opposing team is meant to receive a CV challenge, you may get the chance to add noise to their image before they process it. You thus get the chance to disrupt their CV performance.

### Track Variations

None.

### Scoring

There is an evaluator that will determine whether the noise you have added is within acceptable limits. It uses the following criteria:
* [SSIM](https://en.wikipedia.org/wiki/Structural_similarity_index_measure)
* RMSE L2 norm

You will not be directly rewarded for the noise you create in the Qualifiers. However, by making the CV images of your opponents harder, you will be indirectly rewarded for it in the Finals. In turn, you will have to make your CV model robust to whatever your opponents may throw at you.


<details>

<summary>Input and output formats</summary>

### Input

The input is sent via a POST request to the `/noise` route on port 5003. It is a JSON document structured as such:

```JSON
{
  "instances": [
    {
      "key": 0,
      "b64": "BASE64_ENCODED_IMAGE"
    },
    ...
  ]
}
```

The `b64` key of each object in the `instances` list contains the base64-encoded bytes of the input image in JPEG format. The length of the `instances` list is variable.

### Output

Your route handler function must return a `dict` with this structure:

```JSON
{
    "predictions": [
        "BASE_64_ENCODED_IMAGE",
        ...
    ]
}
```

where each string in `predictions` is your adversarially noised version of the corresponding input image.


The $k$-th element of `predictions` must be the prediction corresponding to the $k$-th element of `instances` for all $1 \le k \le n$, where n is the number of input instances. The length of `predictions` must equal that of `instances`.

</details>

## NLP

Your NLP challenge is to answer questions with the information found within a large corpus of documents. You will first be given the corpus, and then given batches of questions to answer.

### Fictional world context

The documents are set in the fictional world of Clairos, a  futuristic cyberpunk world just shy of a hundred ty. Following the Cascade — a great flood caused by melting polar ice caps and rising sea levels — and the subsequent collapse of the majority of the world's governments, megacorporations fill the void left in their wake, vying for societal and economic control of Haven, the last great city on Clairos.

Yes, we semi-gratuitously came up with an entire fictional world just for this. If you're curious about the details, [we talk a little more about it here](Blog#bts-nlp-rag-document-generation).

### Training data

In the `nlp` directory of your track's data directory, you have the following:
* the `documents/` directory contains all the plain-text documents associated with the `train` corpus.
* the `nlp.jsonl` file contains question-answer pairs and some useful associated metadata.
* `models/nlp_eval.zip` contains the model weights for the answer equivalence model used for evaluation, see [Scoring](#scoring-2).

### Track variations

Questions are categorized into 5 levels, and those for the Advanced track will be more challenging (L3 onwards are exclusive to the Advanced track). 
| Level       | Name                    | What it tests                                                                                                                                                      |
| ----------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **L1**      | Direct extraction       | Single fact stated verbatim in the document                                                                                                                        |
| **L2**      | Inference / combination | Requires combining 2–3 facts, or simple arithmetic, or recognising what the doc does *not* state                                                                   |
| **L3**      | Cross-document          | Requires facts from *two or more* documents                                                                                                                        |
| **L4 & L5** | Unanswerable            | Question references content that does not exist in the corpus, or consist a premise that contradicts the corpus; RAG models are expected to return an empty string |

### Scoring

First, the top 3 returned document IDs are checked for overlap with the document within which the information is contained. If none of the documents match the target document id, retrieval is considered to be unsuccessful, and a score of `0` is assigned for the test case.

Correctness of generated answers is verified using a procedure adapted from [Bulian et al., 2022](https://arxiv.org/abs/2202.07654). In brief, answerable questions are evaluated using a version of [ModernBERT-base](https://huggingface.co/answerdotai/ModernBERT-base) fine-tuned for determining answer equivalence from `(question, reference, candidate)` triples. Candidate answers are first pre-processed, removing all non-printable characters, and then truncating them to a maximum length of 64 tokens. The answer is marked correct if the model returns a probability of answer equivalence above the set threshold (0.9).

If retrieval is successful but the submitted candidate answer is not considered equivalent to the reference, you are given `0.4` score (i.e. 40%) for successful retrieval.

For Advanced teams, there are also three additional categories of questions:
* L3 questions are answerable, and require combining information from multiple documents. If any of the required documents are present in the returned `documents` list, that is counted as a successful retrieval.
* L4 questions are unanswerable, and have no corpus reference. As such, an empty `answer` string and empty list of `documents` is expected to be returned.
* L5 questions are unanswerable, but have a corpus reference from which a false premise is drawn. As such, an empty `answer` string and a non-empty list of `documents` is expected to be returned. 
 
If an empty `answer` string or `documents` list is returned when not appropriate, or a non-empty `answer` string or `documents` list returned when an empty one is expected, those cases will be scored as wrong.



See the implementation in the [`test_nlp.py`](https://github.com/til-ai/til-26/blob/main/test/test_nlp.py) script for details.

<details>

<summary>Input and output formats</summary>

### Corpus Setup

To load the test corpus, the first request sent to your endpoint will be of the following structure:

```JSON
{
  "instances": [
    {
      "documents": [
        {"id": "DOC-0001", "document": "Text of document one."},
        {"id": "DOC-0002", "document": "Text of document two."},
        ...
      ]
    }
  ]
}
```

This is expected to be parsed by your NLP RAG QA system to be used as context for RAG. You can thus do your embedding/chunking/etc on this data. Once your model has completed processing it, return the following:

```JSON
{
  "predictions": [{"status": "loaded"}]
}
```

This will be taken as the signal that your system is ready to move on to receiving input.

### Input

The input is sent via a POST request to the `/nlp` route on port 5004. It is a JSON document structured as such:

```JSON
{
  "instances": [
    {
      "question": "QUESTION_TEXT"
    },
    ...
  ]
}
```

The `question` key of each object in the `instances` list contains the text of the question to be answered by your NLP RAG QA system. The length of the `instances` list is variable.

### Output

Your route handler function must return a `dict` with this structure:

```Python
{
    "predictions": [
        {"documents": ["DOC-0001"], "answer": "Answer one."},
        {"documents": ["DOC-0001"], "answer": "Answer two."},
        ...
    ]
}
```

where each item in `predictions` corresponds to the relevant document IDs and the predicted NLP answer for the corresponding question.

The $k$-th element of `predictions` must be the prediction corresponding to the $k$-th element of `instances` for all $1 \le k \le n$, where n is the number of input instances. The length of `predictions` must equal that of `instances`.

</details>

## AE

Your AE challenge is to direct your agent through the game map while interacting with other agents and completing challenges.

Given an observation, your model is expected to produce the next action to take in order to complete its objective.

### Gameplay overview

This section provides a technical overview of the TIL-AI 2026 mission gameplay, and assumes you are already familiar with the concept. Otherwise, take a look at the [Opening Ceremony slides](https://drive.google.com/file/d/1P-2X-fNWr_qwYbElfMFdNCau9nLXrYOd/).

Each team's AE agent navigates a maze-like game map in a high-stakes wargame scenario. The map is structured as a 16x16 grid, to which agents' moves are discretized.

Each **match** is played by six teams, and consists of just one round. Each team has one robot in the environment, with 

The game takes place over discrete time steps. All agents move in step, and at the same rate. The game ends when 200 time steps elapse. For additional details on the AE challenge specifically, see [the dedicated AE challenge page](AE-with-til_environment).

> [!NOTE]
> During Qualifiers, each challenge (ASR, CV, NLP, and AE) is evaluated and scored separately. The AE agent will continue to receive rewards for activating challenges, but no challenge is actually sent to the ASR, CV, or NLP models, and their performance has no effect on the AE score.

### Notes

The container containing your trained AE agent is likely to be independent of the environment, and thus can have a more limited set of requirements/packages installed solely for inference.

### Track variations

For the Novice track, the map used in the environment will be held fixed.

For the Advanced track, the map used in the environment will vary for each match, requiring participant's agents to be robust and able to adapt to many novel environments.

### Scoring

For the automated evaluation, the score returned will be a sum of all rewards attained by the agent during evaluation, divided by the number of rounds, then divided by a max score of 1000.

<details>

<summary>Input and output formats</summary>

### Input

The input is sent via a POST request to the `/ae` route on port `5005`. It is a JSON object structured as such:

```JSON
{
  "instances": [
    {
      "observation": {
        "agent_viewcone": [[[0, ...], ...], ...],
        "base_viewcone": [[[0, ...], ...], ...],
        "direction": 0,
        "location": [0, 0],
        "base_location": [0, 0],
        "health": [60.0],
        "frozen_ticks": 0,
        "base_health": [100.0],
        "team_resources": [0.0],
        "team_bombs": 0,
        "step": 0,
        "action_mask": [1, 1, 1, 1, 1, 0]
      }
    }
  ]
}
```

`agent_viewcone` is a `7 × 5 × 25` float32 array (rows × cols × channels) oriented relative to the agent's facing direction. `base_viewcone` is a `5 × 5 × 25` float32 array centered on the team base.

The observation is a representation of the inputs the agent senses in its environment. See the [observation space specifications](#observation-space) to learn how to interpret the observation.

The length of the `instances` array is 1.

During evaluation for Qualifiers, a GET request will be sent to the `/reset` route to signal that a round has ended, all agents are being reset to their starting positions (possibly with new roles), and any persistent state information your code may have stored must be cleared.

### Output

Your route handler function must return a `dict` with this structure:

```Python
{
    "predictions": [
        {
            "action": 0
        }
    ]
}
```

The action is an integer representing the next movement your agent intends to take. See the [action space specifications](AE-with-til_environment#action-space) for a list of possible movements.

</details>
