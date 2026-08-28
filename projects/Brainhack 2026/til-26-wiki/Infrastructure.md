This page documents the hardware and software infrastructure on which TIL-AI is built.

**Contents**
1. [Repo structure](#repo-structure)
2. [Software infrastructure](#software-infrastructure)
   1. [Containerization strategy](#containerization-strategy)
   2. [Evaluation methodology](#evaluation-methodology)
3. [Hardware](#hardware)

## Repo structure

Take a look at the [`til-ai/til-26`](https://github.com/til-ai/til-26) template repository. You'll find a subdirectory for each challenge: `asr/`, `cv/`, `noise`, `nlp`, and `ae/`, each containing:

* A `src/` directory, where your code lives.
  * `*_manager.py`, which manages your model. This is where your inference and computation takes place.
  * `*_server.py`, which runs a local FastAPI server that talks to the rest of the competition infrastructure.
* `Dockerfile`, which is used to build your Docker images.
* `requirements.txt`, which lists the dependencies you need to have bundled into your Docker image.
* `README.md`, which contains specifications for the format of each challenge.

You'll also find a final subdirectory, [`test/`](/test). This contains tools to test and score your model locally.

There are two Git submodules, `til-26-finals` and `til-26-environment`. `finals` contains code that will be pulled into your repo for Semifinals and Finals. `environment` contains the `til_environment` package, which you'll need to train and test your AE model, and is installed by `pip` during setup. Make sure you run `git submodule update --init` during the [first time setup](Getting-started).

> [!WARNING]
> Don't delete or modify the contents of `til-26-finals/`, `til-26-environment/`, or the `.gitmodules` file. Doing so would cause issues later when you need to update your repo with code for Semifinals and Finals. You can *add* submodules without issue.

## Software infrastructure

### Containerization strategy

Each of your models is run in its own isolated Docker container. The image contains a model manager (which runs your model and code), and a FastAPI server, which provides an interface between your container and the TIL-AI infrastructure.

The FastAPI server exposes a prediction endpoint (like `/asr`) on a particular port (like `5001`). When your FastAPI server is started up, the TIL-AI evaluator sends a [POST request](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Methods/POST) to your endpoint (like `localhost:5001/asr`) containing the test data your model is to evaluate. Your route handler function receives and parses this data, passes it to your model manager to get predictions, and returns the response containing the prediction results.

Here are the endpoints and ports for each challenge:

| Challenge | Endpoint | Port |
| --------- | -------- | ---- |
| ASR       | `/asr`   | 5001 |
| CV        | `/cv`    | 5002 |
| NOISE     | `/noise` | 5003 |
| NLP       | `/nlp`   | 5004 |
| AE        | `/ae`    | 5005 |

The reason you build separate containers for each challenge (as opposed to having a single server that handles all endpoints) is to make development and testing easier. Because each container is an entirely isolated environment, you can use different Python versions, Python and Linux packages, device drivers, and configurations for each. This can be especially useful because some ML libraries are particular about specific versions of dependencies like `numpy`, or device drivers like CUDA. Containerizing your code reduces the likelihood of dependency conflicts.

### Evaluation methodology

During Qualifiers, we use [Agent Platform online prediction](https://cloud.google.com/agent-platform/docs/predictions/get-online-predictions) to obtain predictions from your containers for the hidden test data. An [Agent Platform Endpoint](https://cloud.google.com/agent-platform/docs/general/deployment) is created from each submitted container, and HTTP requests are made to that endpoint to trigger predictions.

During Semifinals and Finals, we set up a local competition server that interfaces with all your models in real time.

The interfaces for your servers will remain broadly unchanged throughout Qualifiers to Finals.

## Hardware

Below are the hardware specifications of the machines on which your models will run.

|                          | Qualifiers                         | Semifinals and Finals          |
| ------------------------ | ---------------------------------- | ------------------------------ |
| **Machine type**         | Virtual                            | Physical                       |
| **CPU**                  | Intel CPU with 8 logical CPU cores | Intel Core Ultra 7 265k        |
| **RAM**                  | 30 GB                              | 32 GB                          |
| **GPU**                  | Nvidia Tesla T4 with 16 GB VRAM    | NVIDIA RTX 5070 Ti (16GB VRAM) |
| **Disk space**           | 350 GB, excluding 150 GB boot disk | 1 TB                           |
| **Operating system**     | Debian 11                          | Ubuntu 24.04 LTS               |
| **CUDA Toolkit version** | 13.0*                              | 13.0                           |

\* This is achieved using [NVIDIA Forward Compatibility](https://docs.nvidia.com/deploy/cuda-compatibility/forward-compatibility.html) for NVIDIA data center graphics cards. It actually has drivers for CUDA 12.4 installed, but also `cuda-compat-13-0` so the driver can be recognized and used by programs compiled up to CUDA 13.0 (e.g. ordinary builds of PyTorch).

> [!IMPORTANT]
> During Semifinals and Finals, all your models must run **simultaneously** on the physical machine, sharing CPU, GPU, and RAM. We recommend against simply choosing the largest possible models for Qualifiers, because they may not be able to run simultaneously on the Finals machines. There's nothing stopping you from swapping to a different model for Semifinals and Finals after qualifying, but you should carefully consider whether that's the best use of your team's resources.

The GPU for Semifinals and Finals is based on the [Blackwell](https://en.wikipedia.org/wiki/Blackwell_(microarchitecture)) architecture, while the GPU provided by the online development environment is based on [Turing](https://en.wikipedia.org/wiki/Turing_(microarchitecture)).

> [!WARNING]
> We urge you to avoid changing low-level configurations or having your code rely on obscure features in specific driver versions, because this increases the risk of something breaking between the online and physical environments, which you might not have enough time to fix.
