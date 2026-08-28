Here are some ideas for supercharging your workflow, contributed by TIL-AI alumni.

You can, of course, choose which of these suggestions to take on, and we encourage you to explore alternatives that better fit your needs. This isn't meant to be a step-by-step tutorial, so get your hands dirty and try things out!

**Contents**
1. [Using your Workbench instance](#using-your-workbench-instance)
2. [Preventing Docker bloat](#preventing-docker-bloat)
3. [Track history and prevent accidents with Git](#track-history-and-prevent-accidents-with-git)
4. [Back up important checkpoints and model weights](#back-up-important-checkpoints-and-model-weights)
5. [Submissions](#submissions)

## Using your Workbench instance

The Workbench instance is a full GPU-equipped JupyterLab environment, which behaves as you'd expect a typical Python + Jupyter environment to. It's an entire virtual machine you can access on the fly.

You can start and stop your notebook instance from the [Google Cloud Platform UI](https://console.cloud.google.com/agent-platform/workbench/instances?project=til-ai-2026). Though instances will automatically shut down after 30 minutes of inactivity, it is preferred that you shut it down yourself after you are done, to reduce the costs associated with your compute and reduce the risk of accidentally corrupting your instance.

Agent Platfrom Workbench instances have been known to break in the past, which sometimes required resetting. To make sure you don't lose valuable work, we strongly recommend you back up your code and important model weights &mdash; we've outlined a few suggestions here.

## Preventing Docker bloat

As you iterate on your Docker builds, it’s easy to accumulate cruft &mdash; leftover images, stopped containers, dangling layers. Over time, these take up space and can slow things down, or cause weird issues if you accidentally use an outdated image.

To inspect what's sitting around on your machine, run:

```Bash
docker image ls
```

This shows a list of all images currently on your system. You might see something like:

```
REPOSITORY          TAG       IMAGE ID       CREATED         SIZE
my-model            latest    a1b2c3d4e5f6   2 hours ago     4.2GB
<none>              <none>    f6e5d4c3b2a1   2 hours ago     4.2GB
python              3.10      7b8a7f6e5d4c   5 days ago      1.0GB
```

The ones with `<none>` are "dangling images", usually created from rebuilds where the old image was untagged but never deleted.

To see all containers, including those that have exited:

```Bash
docker ps -a
```

Example output:

```
CONTAINER ID   IMAGE         COMMAND               STATUS                     NAMES
e3b1c2d3f4a5   my-model      "python3 main.py"     Exited (0) 2 hours ago     sleepy_hamilton
```

Once you're done with an image or container, clean it up:

```Bash
# Remove a stopped container
docker rm <container_id_or_name>

# Remove an image
docker rmi <image_id_or_name>
```

> [!IMPORTANT]
> Before pruning, double-check that you're not deleting anything important. These commands are irreversible.

Or go nuclear:

```Bash
# Remove all stopped containers
docker container prune

# Remove all unused images
docker image prune

# Remove *all* unused data (containers, images, volumes, networks)
docker system prune
```

> [!WARNING]
> We do NOT advise running `docker system prune -a`. This command is likely to delete some GCP-related Docker images that you don't want to delete, lest you no longer be able to access your instance and lose precious time waiting for `@Tech` to save you. 

## Track history and prevent accidents with Git

[Git](https://git-scm.com/) is a version control tool. It helps you track changes to your code, collaborate with teammates, and roll back if something breaks. Think of it as a time machine for your code. With Git, you can commit, push and pull code to a remote (such as [GitHub](https://github.com/)), branch your repo, and more.

The JupyterLab interface comes with a built-in Git UI, which makes basic usage very simple. We recommend you regularly commit your code and push them to your remote on GitHub. If anything goes wrong with your Workbench instance, your code is easily recoverable. Git also makes it easy to test different solutions (through branching) and roll back to old versions (such as by tagging or checking out old commits).

> [!WARNING]
> Do not use Git to track or back up large files like model weights, checkpoints, or test data. These files should be added to your `.gitignore`. Otherwise, they will quickly cause your workspace to balloon in size, slow down your pulls and pushes, and cause your GitHub repo to exceed usage limits. Anything you ever commit to Git is saved forever, even if you delete them from your workspace later, and can be very difficult to remove. Use your team's Google Cloud Storage bucket to back up large files.

## Back up important checkpoints and model weights

Sometimes, things break. Your Workbench instance might get reset. Your disk might fill up. You might accidentally overwrite your best model with a worse one. We've all been there.

To avoid heartbreak, you can back up your model weights and checkpoints to your team’s shared Google Cloud Storage bucket. This is automatically mounted to your instance at `/home/jupyter/<your-team-id>/`. The folder behaves like a regular part of your file system, but the data lives separately in Google Cloud Storage. Even if your Workbench instance is hard reset, files in your bucket can still be recovered.

Because the folder behaves like a normal folder, you can continue to use regular Bash file operations commands like `cd`, `ls`, `mv`, `cp`, `mkdir`, etc. You can also access it from the JupyterLab file explorer (in the left sidebar). If you've got weights, checkpoints, or other large files you'd like to keep safe, simply `cp` those files to your bucket mount.

> [!IMPORTANT]
> Use GCS to store backups of only important versions of large files. Don't use it as a working directory to store *all* your weights (especially don't write training checkpoints to your GCS bucket directly while training), and don't directly develop in it. Reading and writing to your local disk is fast, whereas writing to GCS involves network I/O, which is far slower (and would slow your training). Though we aim to provide every team with ample storage space on GCS, if your bucket becomes too large, we'll ask you to cut it down.

<details>
<summary>If you want to access your GCS bucket from your local machine, click here for details.</summary>
<br/>

Only your service account is given access to the GCS bucket. As such, you will have to impersonate your service account in order to authenticate your requests. Run this command to ensure subsequent gcloud commands come from your service account:

```bash
gcloud config set auth/impersonate_service_account svc-TEAM-NAME@til-ai-2026.iam.gserviceaccount.com
```

Following this, all your `gcloud storage` commands should work, including `cp`, `mv`, `rsync`, `ls`, etc.

```bash
gcloud storage ls gs://TEAM-NAME-bucket-til-26
```

</details>

## Submissions

Before you submit, especially for the first time, make sure you [test your image](Testing-models) in your Workbench instance to make sure it's working, and get a rough idea of the score. It might take quite a while to get your results back after submitting. You don't want to find out, after a long wait, that all your cases errored out because of a silly mistake like forgetting to import a package. Local testing happens in your Workbench instance so you can see full error logs and which exact test cases failed, which you can't do for submitted models.

You can (and are encouraged to) submit multiple times, but only your best submission will be counted for the leaderboard.

SUBMIT EARLY. Don't put it off all the way until just before the deadline. The submission time is based on when your model is pushed to Artifact Registry and received by our server. As the deadline approaches, many teams submit models in the dying minutes, which can lead to network congestion and rate limiting. If your model doesn't arrive on time, it won't be counted.