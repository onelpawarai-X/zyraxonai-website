# ZYRAXON Isolated Development Runner

The runner is ZYRAXON's cloud-side development computer. It runs in an isolated container and never requires access to the user's laptop or the browser host filesystem.

## Runtime model

```text
ZYRAXON web app
      |
      v
Execution API
      |
      v
Runner Gateway
      |
      +--> isolated workspace (/workspace)
      +--> toolchain registry
      +--> build/test/preview processes
      +--> artifact output (/workspace/.artifacts)
```

## Session policy

A workspace receives one session execution policy. Individual commands do not require repeated browser approval. The policy is enforced server-side and expires with the session.

The initial policy is deliberately scoped to development operations:

- read/write project files inside `/workspace`
- install project dependencies
- run project tests
- run project builds
- start a preview server
- package build artifacts

The runner does not expose the host filesystem, host PowerShell, host credentials, or a host Docker socket.

## Toolchains

The base image contains common web-development tools. Target-specific toolchains are provisioned in the runner environment and cached there. The web application does not download or install SDKs onto the user's machine.

The runner API reports toolchain availability before a build. A build request can ask for a target such as `web`, `linux`, `windows`, or `android`; the runner selects the corresponding provisioned toolchain.

## Deployment requirement

The `runner/` directory is a deployable service definition, but the runner must be deployed as a separate sandboxed service/container. Lovable hosts the ZYRAXON UI; it is not treated as the privileged execution host.
