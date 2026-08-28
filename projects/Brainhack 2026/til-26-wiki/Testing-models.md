After building a Docker image for your model, you can run it locally to test your code and model.

**Contents**
1. [Prerequisites](#prerequisites)
2. [Testing using `til`](#testing-using-til)
3. [Manual Testing](#manual-testing)
   1. [Running your Docker image](#running-your-docker-image)
   2. [Running your container offline](#running-your-container-offline)
   3. [Testing your model](#testing-your-model)
4. [Further reading](#further-reading)

## Prerequisites

You should already have built your Docker image, following the instructions in [Building Docker images](Building-Docker-images).

## Testing using `til`

The `til` script this year has built-in support for testing your Docker image locally. Simply run `til test TASK [TAG]`; for example:
```bash
til test asr
til test noise extra-noisy
```

This will automatically deploy your [Docker image without an internet connection](#running-your-container-offline), allowing you to [ensure your Docker container can run offline](Building-Docker-images#ensure-your-code-works-offline). It will then wait for your container to become healthy before running the associated test script (e.g. `python test/test_asr.py` for `asr`), and neatly cleaning up after itself afterwards.

This is by far the fastest and easiest way to test your submission.

If you're happy with your testing results, you can move on to [submitting your model](Submitting-models).

## Manual Testing

But maybe you're running your testing locally, and you don't have access to the `til` helper. Well, here's how you could accomplish the same testing locally.

### Running your Docker image

**Overview**: Use Docker to start a container and run your image.

An image is just a collection of files. To make it run, we need to tell Docker to start it up in a container.

If you a refresher on your existing images, run `docker image ls` and find the row corresponding to the image you want to test. Note the image name, which appears under `REPOSITORY`.

```
REPOSITORY       TAG       IMAGE ID        CREATED         SIZE
my-team-nlp      latest    ac2e140d85b4    1 minute ago    188MB
```

Then, use Docker to containerize and run your image.

```Bash
docker run -p PORT --gpus all -d IMAGE_NAME:TAG

# Example:
docker run -p 5001:5001 --gpus all -d my-team-asr:latest
```

Let's break this down. The argument `-p` is the port on which the Docker container will listen for requests. `--gpus all` is an optional flag that tells Docker whether to enable GPUs; you don't need this for every image. Adding the optional `-d` flag runs the container in detached mode (i.e. in the background). Finally, `my-team-asr:latest` tells Docker which image ref to run.

Here are the ports for each model, and our suggestion for whether to include the `--gpus all` flag. If your model does not require GPU (as is the case for most AE models), your container runs far quicker and lighter without GPUs.

| Model | `-p`      | `--gpus all` |
| ----- | --------- | ------------ |
| ASR   | 5001:5001 | include      |
| CV    | 5002:5002 | include      |
| NOISE | 5003:5003 | include      |
| NLP   | 5004:5004 | include      |
| AE    | 5005:5005 | omit         |

After you run your image, you can run `docker ps` to see a list of running containers. You can use `docker ps -a` to see a list of all containers, running or not.

> [!NOTE]
> Containers and images are not the same. Images are the snapshots of code, dependencies, and other files that you build from your source code. Containers can be thought of as running instances of images. Don't confuse the two. [Learn more.](https://circleci.com/blog/docker-image-vs-container/)

### Running your container offline
Running a container offline using Docker is relatively straightforward, as you can simply add the `--network none` argument when calling `docker run`. However, you will be unable to access the container on any of its ports, as it literally has no network at all. While this *could* be useful, we specifically want the container to have no internet access, while still being able to communicate with it through `localhost`. As such, to accomplish this, you run this:

```bash
docker network create --subnet 172.28.0.0/16 no_internet
sudo modprobe nf_conntrack
sudo iptables -I DOCKER-USER 1 -s 172.28.0.0/16 -m conntrack --ctstate ESTABLISHED,RELATED -j RETURN
sudo iptables -I DOCKER-USER 2 -s 172.28.0.0/16 -j DROP
```

This creates a Docker network named `no_internet` and configures it to allow inbound traffic, but drop every single packet exiting. We can now instantiate our container the same way we would otherwise:

```bash
docker run -p $port:$port --network no_internet --gpus all $TEAM_NAME-$task:$tag
```

If your code runs successfully offline, you should be able to see the `uvicorn` server start up. After that, you can `docker stop` your container, and also clean up all the network stuff you've created.

```bash
 # clean up network and iptables rules
sudo iptables -D DOCKER-USER -s 172.28.0.0/16 -m conntrack --ctstate ESTABLISHED,RELATED -j RETURN
sudo iptables -D DOCKER-USER -s 172.28.0.0/16 -j DROP
docker network rm no_internet
```

In conclusion, it's so much easier to just use `til test`. Just do that.

### Testing your model

**Overview**: Use the provided testing scripts to test and score your model.

The `test/` directory in the template repo contains Python files that test and score your models locally. To start, simply run the corresponding Python file:

```bash
python test/test_asr.py
```

This will take a while to test your model's performance using your local testing dataset. If there are any errors, you'll see them too. After testing is done, you can see your model's performance as a score. This score will give you a good idea of how your model might perform on the hidden evaluation dataset after you submit it.

> [!IMPORTANT]
> Testing your model locally is only for you to see whether your code works and how your model performs. It doesn't upload your model or record your score in the leaderboard. You must [submit your model](Submitting-models) for the score to count.

When you're done, shut down (kill) your container. First, use `docker ps` to list the running Docker containers, and find the ID of the one you want to shut down. Then, tell Docker to shut down the container.

```bash
docker stop CONTAINER_ID
docker kill CONTAINER_ID # if it's not stopping for some reason
```

If you're happy with the results, you can [submit your model](Submitting-models).

## Further reading

* Running Docker containers: https://docs.docker.com/engine/containers/run
* Docker images vs. containers: https://circleci.com/blog/docker-image-vs-container/
