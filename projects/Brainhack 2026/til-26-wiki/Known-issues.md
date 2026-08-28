Known issues and how to work around them. Have you also checked [`#hackoverflow`](https://discord.com/channels/1488845200523661454/1488845611032903691)?

This will be updated as new issues are identified. If none of these are relevant to you, do also [see here for past issues in TIL-AI 2025](https://github.com/til-ai/til-25/wiki/Known-issues) that may be helpful.

**Contents**
1. [Agent Platform Workbench](#agent-platform-workbench)
   1. [Unresponsive or 502 Error on JupyterLab instance](#unresponsive-or-502-error-on-jupyterlab-instance)

## Agent Platform Workbench

### Unresponsive or 502 Error on JupyterLab instance

Sometimes, when you click on `Open JupyterLab`, the JupyterLab environment fails to load, instead displaying "502. That's an error. That's all we know." Alternatively, the JupyterLab instance can sometimes become unresponsive. This is generally due to a transient network issue of some kind, and is usually fixed by forcing a hard browser refresh (`Ctrl-Shift-R` on Windows or `Cmd-Shift-R` on Mac) on your browser page.