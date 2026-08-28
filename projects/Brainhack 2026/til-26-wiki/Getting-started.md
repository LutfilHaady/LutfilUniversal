Welcome, Strategist! This is your first-time setup guide to get you up and running.

**Contents**
1. [Prerequisites](#prerequisites)
2. [Get to know your Workbench instance](#get-to-know-your-workbench-instance)
   1. [Open your Workbench instance](#open-your-workbench-instance)
   2. [Your JupyterLab interface](#your-jupyterlab-interface)
   3. [Creating your first files](#creating-your-first-files)
   4. [Shutting down your instance](#shutting-down-your-instance)
3. [Clone the template repo](#clone-the-template-repo)
   1. [Generating a GitHub personal access token](#generating-a-github-personal-access-token)
   2. [Cloning your repo](#cloning-your-repo)
4. [Set up your development environment](#set-up-your-development-environment)
   1. [About Python virtual environments](#about-python-virtual-environments)
5. [For power users](#for-power-users)
   1. [Using `gh` to persist Git credentials](#using-gh-to-persist-git-credentials)
   2. [Developing locally](#developing-locally)
   3. [Downloading the training data locally](#downloading-the-training-data-locally)
6. [Further reading](#further-reading)

## Prerequisites

You should already have access to your team's Workbench instance and your team's private channel in the TIL-AI Discord server.

You should know and memorize your **Team ID**. Your Team ID is a unique string that's used for identifying your images, buckets, workbench, results, and other resources. Your Team ID is the same as the name of your team's private Discord channel. This is different to your **Team Name**, which is the name your team used to sign up.

We strongly recommend that you have a [GitHub account](https://github.com), which will allow you to create your own copy of this repository.

## Get to know your Workbench instance

[Agent Platform](https://cloud.google.com/agent-platform?hl=en) is an AI development platform provided by [Google Cloud](https://cloud.google.com/?hl=en). One of its features is the [Agent Platform Workbench](https://cloud.google.com/agent-platform/docs/workbench/introduction), formerly known as Workbench instance, which gives you access to a powerful cloud computer &mdash; complete with a file system, terminal, and useful tools like Python, Jupyter Notebooks, and Git &mdash; where you can run code and train machine learning models.

Your Workbench instance is the primary platform on which you'll develop, train, and test your models. We'll run you through how to access and use your Workbench instance in this section, and then show you how to start developing and training.

If you're already familiar with similar online development environments, you can [skip ahead](#clone-the-template-repo).

> [!WARNING]
> There are some commands that online guides may suggest that you run that are likely to brick your instance and both you and the Tech team a lot of headaches. A limited set of these include:
> * `docker system prune -a`
> * `jupyter notebook --generate-config`
> 
> Furthermore, there will be several GCP-related Docker images that you don't want to delete, and GCP-related containers you don't want to stop. Be careful when performing destructive actions on your instance!

### Open your Workbench instance

Make sure you're logged in to the correct Google account. This is the account using which you completed the Onboarding Form.

Open the [Workbench Instances for TIL-AI 2026](https://console.cloud.google.com/agent-platform/workbench/instances?project=til-ai-2026). You'll see a list of instances, each labelled `instance-TEAM_ID`. To find your instance, filter by the instance name. You'll need to know your [Team ID](#prerequisites).

<!-- filter-vertex-instances -->
https://github.com/user-attachments/assets/23106b8c-1d39-4227-bb91-3c560424c7d7

> [!TIP]
> After you've typed the filter, take a look at the webpage URL in your browser's address bar. You'll see it now ends with `&pageState=(%22WorkbenchInstances%22: ...`. If you bookmark this entire link, the next time you open it, the filter will already be applied.

Next, you need to start your instance. Your instance is a computer that lives in the cloud; just like a normal computer, you need to boot it up. Select the checkbox for your instance, then click **Start**. This might take a few minutes.

<!-- start-instance -->
https://github.com/user-attachments/assets/928cdf3d-f5e6-4fee-920a-a7c00634ef4f

The icon to the left of your instance name is its status. A gray circle with a square inside means your instance is stopped (shut down). A loading indicator means it's currently starting up. A green checkmark means it's started and running.

Once your instance has started, click **Open JupyterLab** to access your team's Workbench instance.

> [!NOTE]
> The correct button to click is **Open JupyterLab**, not the name of your instance. The latter button links to the configuration page for your instance, which you don't have access to.

> [!TIP]
> You can also bookmark the direct link to your instance. However, keep in mind that you'll only be able to open it when it's running.

### Your JupyterLab interface

You'll now see something like this. This interface is called JupyterLab.

<!-- workbench-start-page -->
![workbench-start-page](https://github.com/user-attachments/assets/0cdfa334-d712-4817-ab02-36bb0af96a78)

Let's run through the main components.

1. This is the toolbar. You can select a tab in the toolbar to open them. The tools are, in order: **File Browser, BigQuery, Running Terminals and Kernels, Git, Table of Contents, and Notebook Executor**.
   1. These icons belong to the File Browser. They provide tools to manipulate the file system. You'll mostly use the first four: **Create Launcher, New Folder, Upload Files, and Refresh**.
   2. This is the file list. Use it to open files and folders, and navigate your directory.
2. This is the Main Work Area. When you open new files and terminals, they appear here.
   * It currently shows the **Launcher**. You'll use this to create new notebooks, terminals, Python files, and other files. You can always access the Launcher by clicking the **Create Launcher** button in *1ii*.

Besides the File Browser, there are other useful tools in the Left Sidebar. These are the most useful:

* **Running Terminals and Kernels** shows the terminals and Jupyter notebooks that are currently running.
* **Git** is a version control tool, which you can use to track your code's history. JupyterLab provides a GUI for Git.

> [!TIP]
> You can rearrange windows however you like in the Main Work Area. You can have code side-by-side, or your code above and the terminal for running it below.

Take a look at the [JupyterLab interface docs](https://jupyterlab.readthedocs.io/en/latest/user/interface.html) for a deeper dive. Explore all the menus and dropdowns to get yourself familiar with it.

### Creating your first files

If the **Launcher** isn't already open, click the **File Browser** in the Left Sidebar, then the **Create Launcher** button (the blue + sign).

Let's start with something familiar. To create a Jupyter Notebook, click the **Python 3 (ipykernel)** button under **Notebook**.

<!-- notebook-hello-world -->
https://github.com/user-attachments/assets/308666f1-98f8-403a-a32c-ca4766305ae0

If you're familiar with Jupyter Notebooks, you'll be right at home. You can write Python and documentation, and run your code right from your notebook. For the uninitiated, Jupyter Notebooks let you run Python code in small chunks (called "cells"), and handle some of the tedious work of manually running pure `.py` files, which makes it convenient to test with. [Learn more about Jupyter Notebooks.](https://realpython.com/jupyter-notebook-introduction/)

Next, let's create our first terminal. This is similar to Command Prompt on Windows and Terminal on macOS; it lets you run commands through a command line. In the **Launcher**, click the **Terminal** button, under **Other**.

<!-- terminal-hello-world -->
https://github.com/user-attachments/assets/35b0dc88-5797-406a-90ec-67c74a771daa

The terminal uses Bash, the standard shell scripting language. You don't need in-depth knowledge of it, but you'll need how to run simple commands using the terminal. In this Wiki (and many other docs), if you see an instruction that says "Run this:", and then some code that looks like `app command --options`, it means to run it in the Terminal. [Learn more about shell scripting.](https://www.freecodecamp.org/news/shell-scripting-crash-course-how-to-write-bash-scripts-in-linux/)

You can also run Bash commands inside Jupyter Notebooks. Just create a new cell, and type `!` before your Bash command. That line will be run as a shell script, not Python.

<!-- notebook-shell-script -->
https://github.com/user-attachments/assets/217707ca-f92b-4759-b9a4-6c4372c3bfe6

Finally, let's take a look at how to create and run Python `.py` files. Head back into the launcher, and create a **Python File** and a **Terminal** (both of which are under **Other**). Then, save your Python file, and run it from the terminal using the command `python your_filename.py`

<!-- running-python -->
https://github.com/user-attachments/assets/d5a279f0-9383-4298-a9b8-f2f5293589c0

> [!TIP]
> Re-typing the command to run your Python file every time can get tedious. Luckily, you can press the up arrow key on your keyboard to quickly recall the previous command.

After you open many terminals, consoles, and files, they can get a bit tricky to manage. If a terminal is unresponsive, you'll want to be able to force it to close. To do this, open the Left Sidebar, and click the **Running Terminals and Kernels** tab. You can then see a list of open tabs, kernels, and terminals, which you can shut down individual or all at once. Think of it like Task Manager on Windows or Force Quit on macOS.

<!-- shut-down-terminals -->
https://github.com/user-attachments/assets/0328f09d-87a3-4ca8-aec8-b30823907fd5

There are many other files you can create through the launcher. You can create any text-based file (such as `.json`, `Dockerfile`, etc.) by creating a standard `.txt` file through the Launcher, and renaming the file with the correct extension. You can also upload any file you like from your computer.

> [!IMPORTANT]
> Your Workbench instance is shared within your team. If you open your Workbench instance and create or modify files, start terminals, or run model training, your teammates will see it too. To avoid breaking something by accident, we recommend each member to create their own terminal, and to avoid having two people working on the same file simultaneously.

### Shutting down your instance

To reduce compute costs and minimize the risk of losing data in your instance, you should shut it down when no one in your team is using it. This is the equivalent of turning off your laptop.

First, make sure no one else in your team is using your team's instance, and that no one has left it running to train models. Because your entire team shares an instance, when you shut it down, it's shut down for everyone in your team.

Then, head back to the [Workbench instance list](https://console.cloud.google.com/agent-platform/workbench/instances&project=til-ai-2026), find your instance, select the checkbox next to it, and press **Stop**.

> [!NOTE]
> Your instance is automatically shut down after a while of inactivity, meaning that low amounts of the instance's compute is being used. If you have some long-running process (like training a model), the instance won't shut down automatically (but you should still save periodic checkpoints in case something else goes wrong).

## Clone the template repo

**Overview**: You'll need to copy the files in the [`til-ai/til-26`](https://github.com/til-ai/til-26) repository to your Workbench instance so you can work on your project. You'll use our template to create your own private copy, and clone it into your environment.

**Only one member of your team needs to do this.**

Start by creating your own copy of this repo from the template. Head to [the homepage of this repo](https://github.com/til-ai/til-26) and click: **"Use this template"** → **"Create a new repository"**. Follow the instructions to create a repo in your own GitHub account.

> [!WARNING]
> Make sure your GitHub repo is **private**. Otherwise, anyone on the Internet can view your code (including your competitors!). If you like, you can [give your teammates access to your private repo](https://docs.github.com/en/account-and-profile/setting-up-and-managing-your-personal-account-on-github/managing-access-to-your-personal-repositories/inviting-collaborators-to-a-personal-repository).

> [!NOTE]
> It's not strictly necessary to create your own copy of this template repo. If you know what you're doing, you can simply clone this repo into your Workbench instance, and work locally without pushing your commits to a remote, or even without source control at all. However, we do NOT recommend this. In the event you accidentally brick your Workbench instance, and it needs to be reset, you would lose all your work.

### Generating a GitHub personal access token

To clone your private repo into your workbench, you'll need to authenticate to the Git client in your Workbench instance using a GitHub Personal Access Token (PAT).

These steps need to be done by the person who owns your repo.

1. Go to [Personal access token settings](https://github.com/settings/personal-access-tokens) for your GitHub account.
   * You can also access this by heading to [github.com](https://github.com), logging in, clicking your profile picture in the top right corner, then **Settings** → **Developer settings** (in the left sidebar) → **Personal access tokens** → **Fine-grained tokens**.
2. Click **Generate new token**. You might need to sign in again. Follow the instructions to create a new token.
   * You can fill in any value for **Token name**.
   * Make sure your personal GitHub account is selected under **Resource owner**.
   * Choose an **Expiration**. After this date, your token will become invalid, so make sure it'll work for long enough to last you through the competition.
   * Under **Repository access**, select **Only select repositories**. Then, in the dropdown that appears, choose your copy of the `til-26` repo.
   * Under **Permissions**, expand the **Repository permissions** section. Find **Contents**, then select **Access: Read and write**. You don't need to change anything else.
     * With these settings, your token can only read and write the source code in your repo. You can change these permissions in the future, in case you'd like it to have other permissions.
   * Click **Generate token**, and confirm your selections.
3. On the page that follows, copy the newly generated token and save it somewhere securely. It looks like `github_pat_` followed by a long string of characters.
   * You'll only be shown your token once (immediately after you generate it). After this, GitHub will never show it to you again, so make sure you save it somewhere safe and secure.

Once you have your token, you can use it to authenticate the Git client in your Workbench instance. Every time you run a command that involves authenticating to your remote on GitHub, such as cloning, pushing, and pulling, you'll be asked to provide your **username** and **password**. Your username is your GitHub username, and your password is the PAT you generated in Step 3. You should **not** authenticate using your account's actual password, as this will give it access to *everything* in your account.

[Read more about GitHub Personal Access Tokens.](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)

> [!CAUTION]
> Treat your token like a password. Anyone who has a copy of your token can use its permissions. You can revoke a token at any time if it's compromised.

### Cloning your repo

Now that you're able to authenticate your Git client, we can clone your copy of the template repo and set it up. Open a terminal in your Workbench instance, and run this.

```bash
cd /home/jupyter/
git clone https://github.com/your-github-username/your-repo-name.git
```

You should now see the files in your repo appearing in a folder called `your-repo-name/`. Next, we need to initialize the [submodules](https://www.atlassian.com/git/tutorials/git-submodule) in your repo, which are links to other repos by `til-ai`: [`til-ai/til-26-finals`](https://github.com/til-ai/til-26-finals) and [`til-ai/til-26-ae`](https://github.com/til-ai/til-26-ae).

```bash
git submodule update --init
```

> [!WARNING]
> Don't delete or modify anything in the submodule folders (`til-26-finals/` and `til-26-ae/`), or edit the `.gitmodules` file. These are relied upon by TIL-AI tools to do things like test your models and pull updates for Finals. You can add new submodules if you wish.

Git is a useful tool for tracking the history of your code and protecting against accidents. You can read some of our suggestions for using Git in [Pro tips](Pro-tips#track-history-and-prevent-accidents-with-git).

## Set up your development environment

**Overview**: Now that you've cloned your repo, you can finish setting up the dependencies your code requires.

<details>

<summary><a href="https://realpython.com/python-virtual-environments-a-primer/">Python virtual environments</a> let you create separate environments for different parts of your project. Expand this section for a quick overview. </summary>

### About Python virtual environments

Each virtual environment lives in a subdirectory at the top level of your project folder. With virtual environments, you can have different dependencies and even Python versions for different parts of your project. Each virtual environment contains a fresh, independent installation of Python; you'll use the Python executable inside your virtual environment (not the global system installation) for running your files.

First, create a fresh virtual environment. In the example below, `env` is the name of your environment.

```bash
conda create --name env python==3.12
```

You then need to activate your virtual environment, before you run any Python file or install any dependencies. If you don't activate it, installations and runs will continue to be from your system installation. The first part, `env` in this example, should match the name of your environment you created previously. You might need to do this with every new terminal you create.

```bash
conda activate env
```

Once this is done, you should see something like `(env)` appear before your username in the terminal: `(env) yourname@yourhost`.

To prevent accidentally installing or running stuff in the wrong environment, make a habit of checking the active environment before using the terminal. Remember that the Workbench instance is shared within your team, including any changes you make to the same open terminal.

[Learn more about Python virtual environments](https://realpython.com/effective-python-environment/). [GCP has their own guide too, tailored to Workbench instances](https://docs.cloud.google.com/vertex-ai/docs/workbench/instances/add-environment).

---

</details>
<br/>

In your Workbench instance, create a new terminal, and run this to create a new virtual environment, activate it, and install all the development dependencies in your project.

```bash
# Creates a virtual environment called "env"
conda create --name env python=3.12

# Activates the "env" environment. You might need to do this for every new terminal.
conda activate env

# Installs all the dependencies in requirements-dev.txt.
pip install -r requirements-dev.txt
```

> [!IMPORTANT]
> The [`til-ai/til-26`](https://github.com/til-ai/til-26) template repository requires Python 3.12 or newer, whereas the default version installed in your Workbench instance is Python 3.10. You might be more familiar with `python -m venv`, but `conda` allows us to easily specify a different Python version for our virtual environment, so we suggest using that instead. After the initial setup, both are broadly similar.

One of the dependencies that's installed by pip from `requirements-dev.text` is the `til_environment` Python package, which you'll need to train and test your AE model. You can import this package in any Python code running in your virtual environment (`import til_environment`). We go over this package in [AE with `til_environment`](AE-with-til_environment).

> [!TIP]
> Virtual environments isolate your dependencies. If different parts of your project need conflicting versions of libraries, you can create multiple virtual environments and switch between them. If you're doing this, make sure you check which environment is active before running or installing dependencies.

And now you're all set up, so get coding! Take a peek at the sidebar (on the right) to see what other basics you need to know.

## For power users

This section isn't necessary to get your environment set up. But, we know there are lots of power users amongst our participants who'd like to use their own workflows for development. Since this section is for them, we'll assume a more experienced audience here.

### Using `gh` to persist Git credentials

If you're annoyed by having to repeatedly authenticate Git commands, you can install the GitHub CLI, `gh` using `apt-get`. Then, you can `gh auth login` once with your PAT, and your credentials will be persisted. If you do this, remember that your Workbench instance is shared between all your teammates, so when you log in, they'll be logged in with your PAT too. This also means only one member of your team can be logged in at a time. You can log out using `gh auth logout`.

### Developing locally

If you'd like to stick to your favorite local dev tools like Visual Studio Code, **we suggest that you clone your Git repo to your local machine**, then push your code to your remote and pull it back into your Workbench instance. This is by far the simplest and least technical method. It also has the benefit of not having inactivity timeouts, unlike your Workbench instance.

<details>
<summary>If, however, you do want to use SSH to access your instance and develop remotely, expand this section to learn how.</summary>

<br/>

NOTE: this guide on how to use SSH to access your instance is going to be brief and high-level. If this feels like insufficient information, then you probably shouldn't be trying to do this!

1. [Set up the Google Cloud CLI](https://docs.cloud.google.com/sdk/docs/install-sdk) on your local machine.
2. Create a new SSH public/private key-pair.
   ```bash
   ssh-keygen -t ed25519 -C "TIL-AI 2026"
   ```
3. Add your generated SSH public key to `~/.ssh/authorized_keys` in your instance.
4. From your instance, run this command to find your instance's public IP address.
   ```bash
   curl -H "Metadata-Flavor: Google" http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip
   ```
5. On your local machine, SSH into your instance using its public IP address, using the private key you generated earlier.
   * If your instance is off, you can start it again if you have `gcloud` configured. `gcloud workbench instances start instance-TEAM-ID --location=asia-southeast1-a` (update the location accordingly)
   * Most code editors have extensions that let you develop remotely via SSH; [here's one for VS Code](https://code.visualstudio.com/docs/remote/ssh).
6. Note that it logs you in as a different user. The CLI (e.g. `.bash_profile`) is set up for the `jupyter` user, and so it is suggested that you run `sudo su -l jupyter` to switch to the `jupyter` user and launch a login shell. You can add this command to your new user's `.profile` such that it will switch immediately on shell startup, and you won't have to think about it anymore.

By default, the public IP address for your instance is not static, which means you'll likely need to update the IP address each time it shuts off. If you ping `@Tech` on the Discord server, we can set up a static IP address for your instance. 

</details>
<br/>

Even if you prefer to develop locally, we recommend against [submitting your models](Submitting-models) for evaluation from your local machine. Run the command from the command line on your instance, either from the JupyterLab web interface or via SSH. Your Workbench instance is already set up with the tools and permissions to run submission seamlessly. If you really feel the need to do so, we've written [a brief guide](Submitting-models#for-power-users).

### Downloading the training data locally
Since we know full well that many of you are going to try to download the training data locally anyway, we've decided to formally support it. To do so, you would have to use service account impersonation:

```bash
gcloud config set auth/impersonate_service_account svc-TEAM-ID@til-ai-2026.iam.gserviceaccount.com
# or gs://til-ai-26-novice
gcloud storage ls gs://til-ai-26-advanced
```

This would also let you access your team's bucket data from the CLI as well at `gs://TEAM-ID-bucket-til-26`.

## Further reading

* Introduction to Jupyter Notebooks: https://realpython.com/jupyter-notebook-introduction/
* JupyterLab interface docs: https://jupyterlab.readthedocs.io/en/latest/user/interface.html
* Writing Bash scripts: https://www.freecodecamp.org/news/shell-scripting-crash-course-how-to-write-bash-scripts-in-linux/
* About Git: https://docs.github.com/en/get-started/using-git/about-git
* About GitHub repositories: https://docs.github.com/en/repositories/creating-and-managing-repositories/about-repositories
* About GitHub personal access tokens: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens
* About Git submodules: https://www.atlassian.com/git/tutorials/git-submodule
* About Python virtual environments: https://realpython.com/python-virtual-environments-a-primer/
