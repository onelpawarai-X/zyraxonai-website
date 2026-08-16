# ZYRAXON PowerShell Builder Engine

ZYRAXON now exposes an authenticated Builder execution capability at `/api/public/builder/powershell`.

The endpoint is intentionally task-based rather than accepting an arbitrary shell command. Supported tasks are:

- `diagnose` — reports PowerShell, Node and npm versions.
- `build` — installs dependencies without lifecycle scripts and runs the project's `build` script when present.
- `test` — runs the project's `test` script when present.
- `package` — creates a ZIP artifact from the temporary project workspace.

Generated files are written into a temporary workspace and removed after the task finishes. File count and size are capped, paths are normalized, execution has a hard timeout, and the route requires an authenticated ZYRAXON Supabase session.

## Runner requirement

The deployed server must have PowerShell 7 (`pwsh`) or Windows PowerShell (`powershell`) available. PowerShell 7 is cross-platform, so a Linux runner can host it when the deployment image includes PowerShell. For Windows-specific application packaging, use a Windows runner with the required SDK/toolchain.

The Builder should report the execution result in Activity rather than claiming that a build or package completed when the runner is unavailable.
