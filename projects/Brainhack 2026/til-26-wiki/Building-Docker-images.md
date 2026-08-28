Once your source code is ready for testing and submission, the next step is to build it into a Docker image.

**Contents**
1. [Prerequisites](#prerequisites)
2. [Configuring your build](#configuring-your-build)
   1. [Docker crash course](#docker-crash-course)
   2. [Specify dependencies to install](#specify-dependencies-to-install)
   3. [Write your Dockerfile](#write-your-dockerfile)
   4. [Ensure your code works offline](#ensure-your-code-works-offline)
3. [Build your image](#build-your-image)
4. [For power users](#for-power-users)
5. [Further reading](#further-reading)

## Prerequisites

You should already have set up your Workbench instance. You should also have code and models that are ready to be tested or submitted.

## Configuring your build

We'll use [Docker](https://docs.docker.com/get-started/docker-overview/) to containerize your code, dependencies, and assets (like model weights). Your submission for each task will be built into separate Docker images, which can be run and submitted independently.

<details>

<summary>If you're not familiar with Docker, expand this section for a quick overview.</summary>

### Docker crash course

Docker is a software tool that helps developers build, run and manage containers. Check out the [Docker unit of the TIL-AI curriculum](https://drive.google.com/drive/folders/1C-BP9-9_yfsV0AHtiIz-LM76FHoBTJh9?usp=sharing) to learn more.

_Containers_ are lightweight, portable environments that run the same way everywhere, whether in your Workbench instance, on your laptop, or in the cloud. The foundation of every container is an _image_, which is a blueprint for what the container should contain and how it should behave. You can think of containers as instances of images.

The general Docker workflow involves these steps:

1. Write a Dockerfile, which describes how to build your image (e.g. by specifying which files to copy and which installation commands to run).
   * Building an image is similar to creating a whole new computer with only what you need inside it.
2. _Build_ the image, give it a _tag_ (a name and version), and optionally _push_ it to a container registry so others can access it.
3. To execute your code, you _run_ a container from that image.

---

</details>

### Specify dependencies to install

Dependencies are the third-party packages you import, such as `pytorch` or `numpy`. Because Docker builds an entirely isolated image containing everything your code needs to run, you need to tell Docker which packages to install.

Your dependencies should be listed in `requirements.txt`. This is the standard way most Python package managers, like `pip`, track dependencies. Add your dependencies to this file, one per line. You can optionally specify specific versions.

```
fastapi==0.115.12
uvicorn[standard]==0.34.2
```

Remember that your submission for each task is built into a separate image. Hence, there's a separate `Dockerfile` and `requirements.txt` in each directory. If a dependency needs to be used in more than one image, you need to add it to every corresponding `requirements.txt`.

[Read more about the `requirements.txt` file.](https://www.freecodecamp.org/news/python-requirementstxt-explained/)

### Write your Dockerfile

The `Dockerfile` provides Docker with step-by-step instructions for building your image.

The `til-ai/til-26` template repository already provides a `Dockerfile` for each model. It uses a common base image for ML tasks, configures your environment, installs your dependencies, copies your `src/` directory, and starts your model server.

The base image we suggest using (and include in the corresponding `Dockerfile`) for the AI tasks that require GPU is `nvcr.io/nvidia/pytorch:25.11-py3`. It includes PyTorch 2.10, CUDA 13.0, `cuda-compat-13-0`, among others; for details, see the [NVIDIA release notes for the image](https://docs.nvidia.com/deeplearning/frameworks/pytorch-release-notes/rel-25-11.html). This setup allows containers built on it to run on both the [Turing](https://en.wikipedia.org/wiki/Turing_(microarchitecture))-based GCP hardware and the [Blackwell](https://en.wikipedia.org/wiki/Blackwell_(microarchitecture))-based Finals hardware. This should be more than adequate for most use-cases.

<details>
<summary>If you want to use a different base image, you will need to install the cuda-compat-13-0 package into your container manually. Click here for details.</summary>
<br/>

Add the following lines to your Dockerfile:
```Dockerfile
RUN wget https://developer.download.nvidia.com/compute/cuda/repos/debian12/x86_64/cuda-keyring_1.1-1_all.deb
RUN sudo dpkg -i cuda-keyring_1.1-1_all.deb
RUN sudo apt update && sudo apt install cuda-compat-13-0
ENV LD_LIBRARY_PATH=/usr/local/cuda-13.0/compat
```

We suggest inserting these lines into your Dockerfile near the top, such as immediately after the `FROM ...` line, for effective layer caching.
</details>
<br/>

Here are some things you might wish to change:

* If the default base image doesn't work for you, change it by editing the `FROM` step.
* If you need to copy directories besides `src`, add another `COPY` step.
  * You should store model weights adjacent to `src/`, not inside it. We recommend a top level `models/` folder (e.g. `asr/models/`), which we have already added to the `.gitignore` in the `til-26` repo.

[Read more about `Dockerfile`.](https://docs.docker.com/build/concepts/dockerfile/)

Google Cloud provides some guidelines for how to get GPU-enabled custom containers working:
* [Instructions on getting GPUs working in custom containers.](https://cloud.google.com/agent-platform/docs/training/containers-overview#gpus_in_custom_containers)
* [Pre-built base images with CUDA packages and common ML packages pre-installed.](https://cloud.google.com/deep-learning-containers/docs/choosing-container)

### Ensure your code works offline

Your Docker container won't have access to the Internet when it's being evaluated, so make sure to download your model weights into your `src/` folder before building the image. To test your model image after it's built, you can use `til test TASK [TAG]` (e.g. `til test asr latest` or `til test cv`) to ensure it runs successfully; more on that later in the [Testing models](Testing-models) section.

For instance, the below code won't work because the `.from_pretrained()` method attempts to download a pretrained model from the Hugging Face Hub, which your container can't access.

```Python
from transformers import AutoTokenizer, AutoModel

tokenizer = AutoTokenizer.from_pretrained("distilbert-base-uncased")
model = AutoModel.from_pretrained("distilbert-base-uncased")
```

To fix this particular example, you would download the weights to your `src/` directory before building your container. One way to do this is by running the following code *once*, which downloads a model to the `src/models/` directory:

```Python
AutoTokenizer.from_pretrained("distilbert-base-uncased", cache_dir="src/models/distilbert-base-uncased")
AutoModel.from_pretrained("distilbert-base-uncased", cache_dir="src/models/distilbert-base-uncased")
```

Then change your source code to reference the locally saved model instead of downloading it from Hugging Face:

```Python
tokenizer = AutoTokenizer.from_pretrained("src/models/distilbert-base-uncased")
model = AutoModel.from_pretrained("src/models/distilbert-base-uncased")
```

You can save your model weights in whichever folder you'd like. However, we recommend naming the final folder `models/` because we've added this path to the template's `.gitignore`, which tells Git not to track it. (You shouldn't commit large files like model weights to Git.)

## Build your image

You're now ready to build your Docker image!

The `til` helper has been enhanced to make it easier to build your images in accordance to the image name format. Just run `til build TASK [TAG]` from anywhere in your Workbench instance e.g. `til build noise best-version` or `til build nlp`. If no tag is provided, it will default to `latest`.

> [!TIP]
> Although tags are optional, they're a great way to keep track of your submissions. You can tag your models with a word, semantic version, or commit SHA. Violet, your friendly neighborhood Discord bot, will include your image's tag in your team notifications.


<details>
<summary>If you need/want to build your Docker image manually, click here for instructions. </summary>
<br/>

First, open a new terminal in your Workbench instance, then `cd` into the directory you want to build, such as `asr`, `ocr`, etc. Then, build the image using Docker with an image name and optional tag. Your image name should follow the format `TEAM_ID-CHALLENGE`.

For instance, if your team name is `myteam` and you want to build an image for the NLP challenge:

```bash
# Navigate to build directory
cd /home/jupyter/til-26/nlp

# Build your image and tag it as `latest`.
# Don't forget the period at the end - it tells Docker to build in the current folder.
docker build -t myteam-ocr:latest .

# You can also build without a tag.
docker build -t myteam-ocr .
```

> [!IMPORTANT]
> Your image name must end with `-asr`, `-cv`, `-noise`, `-nlp`, or `-ae`. Otherwise, the model type can't be inferred, and you'll get an error after submitting your model.
</details>
<br/>

Now, if you run `docker image ls`, you should see your image appear:

```
REPOSITORY       TAG       IMAGE ID        CREATED         SIZE
myteam-nlp       latest    ba6519ee9de1    1 minute ago    176MB
```

The next step is to [test your image](Testing-models).

## For power users

Some power users may prefer to train and build models on their local machine rather than Agent Platform ~~Vertex AI~~ Workbench. This section provides additional info for advanced usage.

The TIL-AI evaluator (to which you will need to submit your models for Qualifiers), runs on an x86-64 system. If your local machine uses a different architecture (e.g. Apple Silicon Macs that run on ARM), you need to pass `--platform linux/amd64` to the `docker build` command. You may also consider using `docker buildx`, which allows you to build for multiple platforms in a single command (e.g. one for submission and one for local testing).

If you choose to build your images locally, you need to take extra care while submitting them for evaluation. There's a separate section for power users in [Submitting models](Submitting-models).

## Further reading
Note that Docker is not installed by default on Google Colab; it is best to do any Docker testing on your instance instead.

* TIL-AI 2025 Curriculum unit on Docker: https://drive.google.com/drive/folders/1C-BP9-9_yfsV0AHtiIz-LM76FHoBTJh9
* TIL-AI 2026 Curriculum unit on Docker: https://github.com/til-ai/til-26-curriculum/blob/main/notebooks/unit0_foundations/novice/01_docker_essentials.ipynb
* Docker overview from Docker: https://docs.docker.com/get-started/docker-overview/
* `requirements.txt` explained: https://www.freecodecamp.org/news/python-requirementstxt-explained/
* Dockerfile overview: https://docs.docker.com/build/concepts/dockerfile/
* Building Docker images: https://docs.docker.com/get-started/docker-concepts/building-images/
* Docker multi-platform builds: https://docs.docker.com/build/building/multi-platform/
