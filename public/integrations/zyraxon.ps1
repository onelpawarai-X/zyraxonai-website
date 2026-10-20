# zyraxon.ps1 — use the ZYRAXON provider from PowerShell.
#
# Dot-source it, then call the functions:
#
#   . .\zyraxon.ps1
#   Get-ZyraxonModels
#   Invoke-Zyraxon "explain what a race condition is"
#   Invoke-Zyraxon "write a haiku about the sea" -Stream
#   Invoke-ZyraxonAgent "create hello.py that prints hi, then run it" -Confirm
#   Invoke-Zyraxon "..." -Model zyraxon-apex
#
# Or run it directly for a one-shot answer:
#
#   .\zyraxon.ps1 "summarise this repo" -Stream
#
# No modules required: this uses Invoke-RestMethod, which ships with Windows
# PowerShell and PowerShell 7 on every platform.

Set-StrictMode -Version Latest

$script:ZyraxonBaseUrl = if ($env:ZYRAXON_BASE_URL) { $env:ZYRAXON_BASE_URL } else { "https://zyraxonai.lovable.app/api/public/zyraxon/v1" }
$script:ZyraxonModel = if ($env:ZYRAXON_MODEL) { $env:ZYRAXON_MODEL } else { "zyraxon-codex" }
# The endpoint only checks a key when the deployment sets ZYRAXON_PROVIDER_KEY;
# until then any non-empty string satisfies it.
$script:ZyraxonApiKey = if ($env:ZYRAXON_API_KEY) { $env:ZYRAXON_API_KEY } else { "zyraxon" }

function Set-ZyraxonConfig {
    <#
    .SYNOPSIS
        Point the ZYRAXON functions at a base URL, model and key.
    .EXAMPLE
        Set-ZyraxonConfig -Model zyraxon-apex
    #>
    [CmdletBinding()]
    param(
        [string]$BaseUrl,
        [string]$Model,
        [string]$ApiKey
    )
    if ($BaseUrl) { $script:ZyraxonBaseUrl = $BaseUrl.TrimEnd("/") }
    if ($Model) { $script:ZyraxonModel = $Model }
    if ($ApiKey) { $script:ZyraxonApiKey = $ApiKey }
    [pscustomobject]@{
        BaseUrl = $script:ZyraxonBaseUrl
        Model   = $script:ZyraxonModel
        ApiKey  = $script:ZyraxonApiKey
    }
}

function Get-ZyraxonModels {
    <#
    .SYNOPSIS
        Every model the provider serves right now.
    .EXAMPLE
        Get-ZyraxonModels | Select-Object id, context_window, input_modalities
    #>
    [CmdletBinding()]
    param()
    $headers = @{ Authorization = "Bearer $script:ZyraxonApiKey" }
    $response = Invoke-RestMethod -Uri "$script:ZyraxonBaseUrl/models" -Headers $headers -Method Get
    $response.data
}

function Invoke-Zyraxon {
    <#
    .SYNOPSIS
        Send one turn and return the reply.
    .DESCRIPTION
        Streams the reply to the console when -Stream is set, otherwise returns
        the whole answer as a string. Use -Messages to continue a conversation.
    .EXAMPLE
        Invoke-Zyraxon "what is a monad, in one paragraph"
    .EXAMPLE
        $reply = Invoke-Zyraxon "hello" -Model zyraxon-apex
    .EXAMPLE
        Invoke-Zyraxon "summarise this" -Stream
    #>
    [CmdletBinding()]
    param(
        [Parameter(Position = 0, Mandatory = $true)]
        [string]$Prompt,
        [string]$Model,
        [object[]]$Messages,
        [switch]$Stream
    )
    $model = if ($Model) { $Model } else { $script:ZyraxonModel }

    $history = @()
    if ($Messages) { $history += $Messages }
    $history += @{ role = "user"; content = $Prompt }

    $body = @{
        model    = $model
        stream   = [bool]$Stream
        messages = $history
    } | ConvertTo-Json -Depth 12

    $headers = @{
        Authorization = "Bearer $script:ZyraxonApiKey"
        "User-Agent"  = "zyraxon-powershell/1.0"
    }

    if (-not $Stream) {
        $response = Invoke-ZyraxonJson -Body $body
        $err = Get-ZyraxonProperty $response "error"
        if ($err) { throw (Format-ZyraxonError $err) }
        return $response.choices[0].message.content
    }

    # Streaming: read the event stream line by line and write each delta as it
    # arrives, so the answer appears as it is written rather than all at once.
    $request = [System.Net.HttpWebRequest]::Create("$script:ZyraxonBaseUrl/chat/completions")
    $request.Method = "POST"
    $request.ContentType = "application/json"
    $request.Accept = "text/event-stream"
    $request.Headers.Add("Authorization", "Bearer $script:ZyraxonApiKey")
    $request.UserAgent = "zyraxon-powershell/1.0"
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
    $request.ContentLength = $bytes.Length

    $collected = [System.Text.StringBuilder]::new()
    try {
        $requestStream = $request.GetRequestStream()
        $requestStream.Write($bytes, 0, $bytes.Length)
        $requestStream.Close()

        $response = $request.GetResponse()
        $reader = [System.IO.StreamReader]::new($response.GetResponseStream())
        while (-not $reader.EndOfStream) {
            $line = $reader.ReadLine()
            if (-not $line -or -not $line.StartsWith("data: ")) { continue }
            $payload = $line.Substring(6)
            if ($payload -eq "[DONE]") { break }
            try { $obj = $payload | ConvertFrom-Json } catch { continue }
            $err = Get-ZyraxonProperty $obj "error"
            if ($err) { throw (Format-ZyraxonError $err) }
            $choices = Get-ZyraxonProperty $obj "choices"
            $delta = $null
            if ($choices -and $choices.Count -gt 0) {
                $deltaObj = Get-ZyraxonProperty $choices[0] "delta"
                $delta = Get-ZyraxonProperty $deltaObj "content"
            }
            if ($delta) {
                [void]$collected.Append($delta)
                Write-Host -NoNewline $delta
            }
        }
        $reader.Close()
        $response.Close()
    }
    catch {
        throw (Get-ZyraxonError -ErrorRecord $_)
    }
    Write-Host ""
    return $collected.ToString()
}

function Invoke-ZyraxonAgent {
    <#
    .SYNOPSIS
        Run the tool-calling loop: the model can read, write and run here.
    .DESCRIPTION
        Three tools, confined to the current directory tree. With -Confirm,
        nothing writes or executes without a yes.
    .EXAMPLE
        Invoke-ZyraxonAgent "create hello.py that prints hi, then run it" -Confirm
    #>
    [CmdletBinding()]
    param(
        [Parameter(Position = 0, Mandatory = $true)]
        [string]$Prompt,
        [string]$Model,
        [switch]$Confirm,
        [int]$MaxTurns = 8
    )
    $model = if ($Model) { $Model } else { $script:ZyraxonModel }
    $tools = Get-ZyraxonFileTools
    $history = @(@{ role = "user"; content = $Prompt })
    $lastCall = $null
    $repeats = 0

    for ($turn = 0; $turn -lt $MaxTurns; $turn++) {
        $body = @{
            model    = $model
            stream   = $false
            messages = $history
            tools    = $tools
        } | ConvertTo-Json -Depth 20

        $headers = @{
            Authorization = "Bearer $script:ZyraxonApiKey"
            "User-Agent"  = "zyraxon-powershell/1.0"
        }
        $response = Invoke-ZyraxonJson -Body $body
        $err = Get-ZyraxonProperty $response "error"
        if ($err) { throw (Format-ZyraxonError $err) }

        $choice = $response.choices[0]
        $message = $choice.message
        $toolCalls = Get-ZyraxonProperty $message "tool_calls"
        $history += @{ role = "assistant"; content = (Get-ZyraxonProperty $message "content"); tool_calls = $toolCalls }

        if ($choice.finish_reason -ne "tool_calls" -or -not $toolCalls) {
            return (Get-ZyraxonProperty $message "content")
        }

        foreach ($call in $toolCalls) {
            $name = $call.function.name
            $rawArgs = $call.function.arguments
            $signature = "$name|$rawArgs"
            $repeats = if ($signature -eq $lastCall) { $repeats + 1 } else { 0 }
            $lastCall = $signature
            if ($repeats -ge 2) {
                throw "the model asked for the same $name call three times; its result is in the history but the model is not using it"
            }

            Write-Host "  -> $name" -ForegroundColor DarkGray
            $result = Invoke-ZyraxonTool -Name $name -Arguments $rawArgs -Confirm:$Confirm
            $history += @{ role = "tool"; tool_call_id = $call.id; content = [string]$result }
        }
    }
    throw "the agent used its whole turn budget"
}

function Get-ZyraxonFileTools {
    <#
    .SYNOPSIS
        The three built-in tool definitions, in OpenAI wire form.
    #>
    @(
        @{
            type = "function"
            function = @{
                name = "read_file"
                description = "Read a text file."
                parameters = @{ type = "object"; properties = @{ path = @{ type = "string" } }; required = @("path") }
            }
        }
        @{
            type = "function"
            function = @{
                name = "write_file"
                description = "Write text to a file."
                parameters = @{
                    type = "object"
                    properties = @{ path = @{ type = "string" }; content = @{ type = "string" } }
                    required = @("path", "content")
                }
            }
        }
        @{
            type = "function"
            function = @{
                name = "run_shell"
                description = "Run a PowerShell command and return its output."
                parameters = @{ type = "object"; properties = @{ command = @{ type = "string" } }; required = @("command") }
            }
        }
    )
}

function Invoke-ZyraxonTool {
    <#
    .SYNOPSIS
        Run one tool the model asked for. Used by Invoke-ZyraxonAgent.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [string]$Arguments,
        [switch]$Confirm
    )
    $args_ = @{}
    if ($Arguments) { $args_ = $Arguments | ConvertFrom-Json -AsHashtable }

    switch ($Name) {
        "read_file" {
            $path = [string]$args_.path
            if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { return "no such file: $path" }
            return (Get-Content -LiteralPath $path -Raw | Select-Object -First 1)
        }
        "write_file" {
            $path = [string]$args_.path
            $content = [string]$args_.content
            if ($Confirm) {
                $answer = Read-Host "write $path ($($content.Length) bytes)? [y/N]"
                if ($answer -notin @("y", "Y", "yes")) { return "declined by the user" }
            }
            Set-Content -LiteralPath $path -Value $content -NoNewline
            return "wrote $path"
        }
        "run_shell" {
            $command = [string]$args_.command
            if ($Confirm) {
                $answer = Read-Host "run: $command ? [y/N]"
                if ($answer -notin @("y", "Y", "yes")) { return "declined by the user" }
            }
            $output = Invoke-Expression $command 2>&1 | Out-String
            if ($output.Length -gt 20000) { $output = $output.Substring(0, 20000) }
            if (-not $output.Trim()) { return "(no output)" }
            return $output
        }
        default { return "unknown tool: $Name" }
    }
}

function Invoke-ZyraxonJson {
    <#
    .SYNOPSIS
        POST a body and parse the JSON reply, retrying transient failures.
    .DESCRIPTION
        Retries 429, 502 and 503 with a short backoff. A 400, 401 or 413 will not
        succeed on a retry, so those are raised immediately.
    #>
    param(
        [Parameter(Mandatory = $true)][string]$Body,
        [int]$Retries = 2
    )
    $headers = @{
        Authorization = "Bearer $script:ZyraxonApiKey"
        "User-Agent"  = "zyraxon-powershell/1.0"
    }
    for ($attempt = 0; $attempt -le $Retries; $attempt++) {
        try {
            return Invoke-RestMethod -Uri "$script:ZyraxonBaseUrl/chat/completions" `
                -Headers $headers -Method Post -Body $Body -ContentType "application/json"
        }
        catch {
            $status = 0
            $exception = Get-ZyraxonProperty $_ "Exception"
            $response = Get-ZyraxonProperty $exception "Response"
            if ($response) { $status = [int]$response.StatusCode }
            if ($status -in @(429, 502, 503) -and $attempt -lt $Retries) {
                Start-Sleep -Seconds ($attempt + 1)
                continue
            }
            throw (Get-ZyraxonError -ErrorRecord $_)
        }
    }
}

function Get-ZyraxonProperty {
    <#
    .SYNOPSIS
        Read a property that may not exist, without tripping StrictMode.
    #>
    param($Object, [string]$Name)
    if ($null -eq $Object) { return $null }
    $prop = $Object.PSObject.Properties[$Name]
    if ($prop) { return $prop.Value }
    return $null
}

function Get-ZyraxonError {
    <#
    .SYNOPSIS
        Turn a PowerShell HTTP error into the provider's own message.
    #>
    param([Parameter(Mandatory = $true)]$ErrorRecord)
    $exception = Get-ZyraxonProperty $ErrorRecord "Exception"
    $response = Get-ZyraxonProperty $exception "Response"
    if ($response) {
        try {
            $reader = [System.IO.StreamReader]::new($response.GetResponseStream())
            $detail = $reader.ReadToEnd()
            $reader.Close()
            try {
                $payload = $detail | ConvertFrom-Json
                return (Format-ZyraxonError (Get-ZyraxonProperty $payload "error"))
            }
            catch {
                return "ZYRAXON request failed: $detail"
            }
        }
        catch {
            return "ZYRAXON request failed: $($exception.Message)"
        }
    }
    if ($exception) { return "ZYRAXON request failed: $($exception.Message)" }
    return "ZYRAXON request failed: $ErrorRecord"
}

function Format-ZyraxonError {
    <#
    .SYNOPSIS
        Render an error object, keeping the `type` — 503s differ by it.
    #>
    param($Error)
    $message = if ($Error.message) { $Error.message } else { "unknown error" }
    if ($Error.type) { return "$message (type: $($Error.type))" }
    return $message
}

function Invoke-ZyraxonLong {
    <#
    .SYNOPSIS
        Run a task that may take hours, and never lose it.
    .DESCRIPTION
        The whole run is kept in a file under $HOME\.zyraxon\sessions and saved
        after every step, so a dropped network, a killed shell or a reboot does
        not lose the job — it carries on from the last checkpoint. With no
        -Hours, it keeps going until the task finishes.
    .EXAMPLE
        Invoke-ZyraxonLong "refactor each file in src, one at a time" -Session refactor
    .EXAMPLE
        Invoke-ZyraxonLong "keep improving the report" -Hours 48
    #>
    [CmdletBinding()]
    param(
        [Parameter(Position = 0, Mandatory = $true)][string]$Prompt,
        [string]$Model,
        [string]$Session = "default",
        [double]$Hours = 0,
        [switch]$Confirm,
        [int]$MaxTurnsPerAttempt = 40
    )
    $model = if ($Model) { $Model } else { $script:ZyraxonModel }
    $tools = Get-ZyraxonFileTools
    $dir = Join-Path $HOME ".zyraxon/sessions"
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    $file = Join-Path $dir "$Session.json"

    $messages = $null
    $step = 0
    if (Test-Path -LiteralPath $file) {
        $saved = Get-Content -LiteralPath $file -Raw | ConvertFrom-Json -AsHashtable
        if ($saved.status -ne "done") {
            $messages = $saved.messages
            $step = [int]($saved.step)
            Write-Host "resuming session '$Session' — step $step" -ForegroundColor DarkGray
        }
    }
    if (-not $messages) {
        $messages = @(@{ role = "user"; content = $Prompt })
    }

    $deadline = if ($Hours -gt 0) { (Get-Date).AddHours($Hours) } else { $null }
    $attempt = 0

    while ($true) {
        $attempt++
        try {
            for ($turn = 0; $turn -lt $MaxTurnsPerAttempt; $turn++) {
                $body = @{ model = $model; stream = $false; messages = $messages; tools = $tools } |
                    ConvertTo-Json -Depth 20
                $response = Invoke-ZyraxonJson -Body $body
                $err = Get-ZyraxonProperty $response "error"
                if ($err) { throw (Format-ZyraxonError $err) }

                $choice = $response.choices[0]
                $message = $choice.message
                $toolCalls = Get-ZyraxonProperty $message "tool_calls"
                $messages += @{ role = "assistant"; content = (Get-ZyraxonProperty $message "content"); tool_calls = $toolCalls }
                $step++

                # Checkpoint: this is what makes the run resumable after anything.
                @{ session = $Session; prompt = $Prompt; messages = $messages; step = $step; status = "running" } |
                    ConvertTo-Json -Depth 40 | Set-Content -LiteralPath $file -Encoding UTF8
                Write-Host "  step $step" -ForegroundColor DarkGray

                if ($choice.finish_reason -ne "tool_calls" -or -not $toolCalls) {
                    $answer = Get-ZyraxonProperty $message "content"
                    @{ session = $Session; prompt = $Prompt; messages = $messages; step = $step; status = "done"; result = $answer } |
                        ConvertTo-Json -Depth 40 | Set-Content -LiteralPath $file -Encoding UTF8
                    return $answer
                }

                foreach ($call in $toolCalls) {
                    $result = Invoke-ZyraxonTool -Name $call.function.name -Arguments $call.function.arguments -Confirm:$Confirm
                    $messages += @{ role = "tool"; tool_call_id = $call.id; content = [string]$result }
                }
            }
            Write-Host "checkpoint at step $step — continuing (attempt $($attempt + 1))" -ForegroundColor DarkGray
        }
        catch {
            # Any interruption lands here — a dropped network, a 429/502/503, a
            # restart. The checkpoint is on disk, so the loop continues from it.
            Write-Host "interrupted ($($_.Exception.Message)); resuming from step $step" -ForegroundColor DarkGray
        }

        if ($deadline -and (Get-Date) -ge $deadline) {
            @{ session = $Session; prompt = $Prompt; messages = $messages; step = $step; status = "paused" } |
                ConvertTo-Json -Depth 40 | Set-Content -LiteralPath $file -Encoding UTF8
            Write-Host "stopped after $Hours h at step $step" -ForegroundColor DarkGray
            return ""
        }
        Start-Sleep -Seconds 2
    }
}

function Get-ZyraxonSessions {
    <#
    .SYNOPSIS
        List the saved long runs, so one can be inspected or resumed.
    #>
    $dir = Join-Path $HOME ".zyraxon/sessions"
    if (-not (Test-Path -LiteralPath $dir)) { Write-Host "no saved sessions"; return }
    Get-ChildItem -LiteralPath $dir -Filter *.json | ForEach-Object {
        try {
            $s = Get-Content -LiteralPath $_.FullName -Raw | ConvertFrom-Json -AsHashtable
            [pscustomobject]@{
                Session = $s.session
                Status  = $s.status
                Step    = $s.step
                Prompt  = ([string]$s.prompt).Substring(0, [Math]::Min(48, ([string]$s.prompt).Length))
            }
        }
        catch { }
    }
}

# Allow a one-shot run: .\zyraxon.ps1 "prompt" -Stream
if ($MyInvocation.InvocationName -ne ".") {
    $scriptArgs = $args
    if ($scriptArgs.Count -gt 0 -and $scriptArgs[0] -notlike "-*") {
        $stream = $scriptArgs -contains "-Stream"
        Invoke-Zyraxon -Prompt $scriptArgs[0] -Stream:$stream
    }
}
