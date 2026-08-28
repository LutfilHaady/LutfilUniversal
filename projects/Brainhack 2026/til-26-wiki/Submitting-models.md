To get your score recorded, you need to submit your model for evaluation.

**Contents**
1. [Prerequisites](#prerequisites)
2. [Submitting your model](#submitting-your-model)
3. [For power users](#for-power-users)
4. [Further reading](#further-reading)

## Prerequisites

You should already have built your Docker image, following the instructions in [Building Docker images](Building-Docker-images).

We recommend that you first [test your model locally](Testing-models) to catch errors earlier.

Additionally, you will have to configure Docker to use `gcloud` for authentication with Artifact Registry. This setup only needs to be done once and should have automatically been completed, but in case it is not, it can be done by running the following command on your instance:

```bash
gcloud auth configure-docker asia-southeast1-docker.pkg.dev
```

Do also make sure that you are authenticated as your service account. You can check which account you're authenticated as by running `gcloud auth list`. If you're authenticated as the wrong account, you can run `gcloud config set account svc-TEAM-NAME@til-ai-2026.iam.gserviceaccount.com` to fix it.

If you're attempting to submit from your own local machine, as we recommend you *NOT* to do, you can run `gcloud config set auth/impersonate_service_account svc-TEAM-NAME@til-ai-2026.iam.gserviceaccount.com` to send all subsequent commands from that terminal session from your service account.

## Submitting your model

**Overview**: Submit your model for evaluation by pushing your Docker image using the `til` command.

Submitting your model is easy, just use the `til submit TASK [TAG]` (tag is optional) command in your Workbench instance. You'll need to pass in the competition task that you wish to submit, and optionally also the particular tag associated with your image. If one is not provided, the script will default to the `latest` tag.

```Bash
# examples
til submit ae
til submit nlp best-rag
```

> [!NOTE]
> The `til` command is only available in your Workbench instance. It's not builtin or installable via tools like `apt` or `brew`. We strongly recommend that you submit your models from your Workbench instance, but if you must, we explain how to do it manually [below](#for-power-users).

This will push your model to Google Artifact Registry and submit it for evaluation. You'll receive notifications on your team's private Discord channel when your model has been submitted, queued, and evaluated. If you achieve a new high score, it'll be updated in the [Leaderboard](https://tribegroup.notion.site/Project-Submission-33a5263ef45a80c3bad7d6006752cba4#33a5263ef45a810995a9c268bdbc20b6).

## For power users

Using the `til` CLI is the best option for the vast majority of participants. Though you can avoid `til submit` by running its constituent steps manually, there is almost never a need to do so. 

The one exception is if you prefer to train your models on your local machine, in which case your images will be built entirely locally, and you may want to submit your model directly from there. We do not formally support submitting from your own local machine, and thus have not fully tested the following submission process. We recommend doing your model training and submission on your Workbench instance. If you're only using your local machine to write code, while your training still takes place on your instance, you won't need to deal with any of this. Since this section is for participants who are already familiar with AI development, we'll gloss over some beginner-level details.

`til submit` runs three commands to submit your model:
* `docker tag` to tag your model image with the URI of your team's repository on Google Artifact Registry.
* `docker push` to push your image.
* `gcloud ai models upload` to upload your model to Google AI Platform for evaluation.

You need to tag your Docker image with your team's Google Artifact Registry repository URI (as well as the image ref `name:tag`), which is of the format `asia-southeast1-docker.pkg.dev/til-ai-2026/repo-til-26-TEAM_ID`.

First, you'll have to make sure Docker is able to push to your team's Artifact Registry repository. You can do this using service account impersonation:

```bash
gcloud config set auth/impersonate_service_account svc-TEAM-ID@til-ai-2026.iam.gserviceaccount.com
gcloud auth configure-docker -q asia-southeast1-docker.pkg.dev
```

Then you should be able to push your image to Artifact Registry:

```bash
docker push asia-southeast1-docker.pkg.dev/til-ai-2026/repo-til-26-TEAM_ID/TEAM_ID-TASK:TAG
```

Here are the flags you need to pass to `gcloud ai models upload`:
* `--region`: `asia-southeast1`
* `--display-name`: The name of your image.
* `--container-image-uri`: The full URI of your container image on Artifact Registry, including the image ref.
* `--container-health-route`: `/health`
* `--container-predict-route`: The prediction endpoint route in your model server. This is different for each model; check the [Challenge specifications](Challenge-specifications) for the input and output format.
* `--container-ports`: The port on which your server is listening. This is different for each model; check the [Challenge specifications](Challenge-specifications) for the input and output format.
* `--version-aliases`: `default`

To submit locally, you also need to be using service account impersonation, but once you run the `gcloud config set aut/impersonate_service_account` command, you should be set:
```bash
gcloud ai models upload ...
```

<details>

<summary>There is another way involving generating an access token and using that for authentication. Instructions for that are reproduced here, but it's more complicated and so less useful for most teams.</summary>

Run the `gcloud auth print-access-token` command from your Workbench instance, and use that to run `docker login -u oauth2accesstoken -p YOUR_ACCESS_TOKEN_HERE https://asia-southeast1-docker.pkg.dev` from your local machine. Refer to the docs on [configuring Docker authentication to Artifact Registry](https://cloud.google.com/artifact-registry/docs/docker/authentication#token) for details. 

You can use the same access token you generated earlier to authenticate requests from your local `gcloud` client by writing them to a file and passing in the `--access-token-file your/access/token/file` CLI argument to your `gcloud ai models upload` command. 

</details>

## Further reading

* About Docker tags: https://docs.docker.com/docker-hub/repos/manage/hub-images/tags
* Build and push your first image: https://docs.docker.com/get-started/introduction/build-and-push-first-image/
* Docs for `gcloud ai models upload` : https://cloud.google.com/sdk/gcloud/reference/ai/models/upload
* Docs for `gcloud auth print-service-token`: https://cloud.google.com/sdk/gcloud/reference/auth/print-access-token
* Configure authentication to Artifact Registry for Docker: https://cloud.google.com/artifact-registry/docs/docker/authentication
