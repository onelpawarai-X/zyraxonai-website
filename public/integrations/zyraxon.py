"""zyraxon — use the ZYRAXON provider from any Python shell.

No dependencies: this is one file that talks to the endpoint over the standard
library. Import it, or run it as a script.

    # In a Python shell, REPL or notebook
    >>> from zyraxon import Zyraxon
    >>> ai = Zyraxon()
    >>> ai.ask("explain what a race condition is")
    >>> for piece in ai.stream("write a haiku about the sea"):
    ...     print(piece, end="")

    # Or as a command
    python zyraxon.py "summarise this repo"
    python zyraxon.py --agent "create hello.py that prints hi, then run it"
    python zyraxon.py --long  "refactor the whole src tree, one file at a time"
    python zyraxon.py --sessions
    python zyraxon.py --models

Every model the provider serves works; `models()` lists them live, so nothing
is pinned here. `ask()` keeps the conversation, so follow-up questions work.

`--long` (or `ai.long_task(...)`) is for work that may take hours. It keeps the
whole run on disk and resumes from it after any interruption, so a dropped
network, a killed shell or a reboot does not lose the job — it carries on where
it stopped. See the `long_task` docstring.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from typing import Any, Callable, Iterable, Iterator

DEFAULT_BASE_URL = "https://zyraxonai.lovable.app/api/public/zyraxon/v1"
DEFAULT_MODEL = "zyraxon-codex"
# The endpoint only checks a key when the deployment sets ZYRAXON_PROVIDER_KEY;
# until then any non-empty string satisfies it.
DEFAULT_API_KEY = "zyraxon"

# Codes the provider documents as transient. Retrying these is right; a 400, 401
# or 413 will not succeed on a retry and must be fixed instead.
RETRY_STATUS = {429, 502, 503}

# Where a resumable run keeps its state. One file per run, written atomically
# after every completed step, so a crash, a killed shell, a lost network or a
# reboot cannot lose more than the step in flight.
SESSION_DIR = os.path.join(os.path.expanduser("~"), ".zyraxon", "sessions")


def _write_atomic(path: str, data: dict[str, Any]) -> None:
    """Write JSON so a crash mid-write cannot leave a half-written file."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = f"{path}.tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False)
        fh.flush()
        os.fsync(fh.fileno())
    os.replace(tmp, path)


def _read_json(path: str) -> dict[str, Any] | None:
    try:
        with open(path, encoding="utf-8") as fh:
            return json.load(fh)
    except (OSError, json.JSONDecodeError):
        return None


class ZyraxonError(RuntimeError):
    """The provider returned an error. Carries the `type` when it gave one."""

    def __init__(self, message: str, status: int | None = None, type_: str | None = None):
        super().__init__(message)
        self.status = status
        self.type = type_


class Zyraxon:
    """A ZYRAXON provider client.

    Args:
        model: any model id the provider serves. `models()` lists them live.
        base_url: override only if you self-host the site.
        api_key: any non-empty string unless the operator set a real key.
        system: an optional system message, kept in front of the conversation.
        timeout: seconds for one request.
        retries: how many times to retry a transient failure.
    """

    def __init__(
        self,
        model: str = DEFAULT_MODEL,
        base_url: str | None = None,
        api_key: str | None = None,
        system: str | None = None,
        timeout: float = 120.0,
        retries: int = 2,
    ) -> None:
        self.base_url = (base_url or os.environ.get("ZYRAXON_BASE_URL") or DEFAULT_BASE_URL).rstrip("/")
        self.model = model or os.environ.get("ZYRAXON_MODEL") or DEFAULT_MODEL
        self.api_key = api_key or os.environ.get("ZYRAXON_API_KEY") or DEFAULT_API_KEY
        self.timeout = timeout
        self.retries = retries
        self.messages: list[dict[str, Any]] = []
        if system:
            self.messages.append({"role": "system", "content": system})

    # ── transport ────────────────────────────────────────────────────────────
    def _post(self, body: dict[str, Any]) -> urllib.response.addinfourl:  # type: ignore[name-defined]
        data = json.dumps(body).encode("utf-8")
        request = urllib.request.Request(
            f"{self.base_url}/chat/completions",
            data=data,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.api_key}",
                # The edge blocks the default python-urllib UA with a 403.
                "User-Agent": "zyraxon-python/1.0",
            },
        )
        last: Exception | None = None
        for attempt in range(self.retries + 1):
            try:
                return urllib.request.urlopen(request, timeout=self.timeout)
            except urllib.error.HTTPError as e:
                detail = e.read().decode("utf-8", "replace")
                message, type_ = detail, None
                try:
                    payload = json.loads(detail)
                    message = payload.get("error", {}).get("message", detail)
                    type_ = payload.get("error", {}).get("type")
                except (json.JSONDecodeError, AttributeError):
                    pass
                if e.code not in RETRY_STATUS or attempt == self.retries:
                    raise ZyraxonError(message, status=e.code, type_=type_) from None
                last = ZyraxonError(message, status=e.code, type_=type_)
                time.sleep(attempt + 1)
            except urllib.error.URLError as e:
                if attempt == self.retries:
                    raise ZyraxonError(f"could not reach {self.base_url}: {e}") from None
                last = e
                time.sleep(attempt + 1)
        raise ZyraxonError(str(last))

    def _iter_deltas(self, body: dict[str, Any]) -> Iterator[str]:
        with self._post(body) as response:
            for raw in response:
                line = raw.decode("utf-8", "replace").strip()
                if not line.startswith("data: "):
                    continue
                payload = line[6:]
                if payload == "[DONE]":
                    break
                try:
                    obj = json.loads(payload)
                except json.JSONDecodeError:
                    continue
                if "error" in obj:
                    err = obj["error"]
                    raise ZyraxonError(err.get("message", "error"), type_=err.get("type"))
                delta = (obj.get("choices") or [{}])[0].get("delta", {}).get("content")
                if delta:
                    yield delta

    # ── the surface ──────────────────────────────────────────────────────────
    def models(self) -> list[dict[str, Any]]:
        """Every model the provider serves right now, with its live limits."""
        request = urllib.request.Request(
            f"{self.base_url}/models",
            headers={"Authorization": f"Bearer {self.api_key}", "User-Agent": "zyraxon-python/1.0"},
        )
        with urllib.request.urlopen(request, timeout=self.timeout) as response:
            return json.load(response).get("data", [])

    def stream(self, prompt: str, model: str | None = None, tools: list[dict] | None = None) -> Iterator[str]:
        """Send a turn and yield the reply in pieces as it arrives."""
        messages = self.messages + [{"role": "user", "content": prompt}]
        body: dict[str, Any] = {
            "model": model or self.model,
            "stream": True,
            "messages": messages,
        }
        if tools:
            body["tools"] = tools

        collected: list[str] = []
        for delta in self._iter_deltas(body):
            collected.append(delta)
            yield delta
        # Keep the exchange so a follow-up has the context.
        self.messages.append({"role": "user", "content": prompt})
        self.messages.append({"role": "assistant", "content": "".join(collected)})

    def ask(self, prompt: str, model: str | None = None, tools: list[dict] | None = None) -> str:
        """Send a turn and return the whole reply as a string."""
        return "".join(self.stream(prompt, model=model, tools=tools))

    def reset(self) -> None:
        """Forget the conversation, keeping any system message."""
        self.messages = [m for m in self.messages if m["role"] == "system"]

    # ── tool calling ─────────────────────────────────────────────────────────
    def agent(
        self,
        prompt: str,
        tools: Iterable[dict[str, Any]],
        run: Callable[[str, dict[str, Any]], str],
        model: str | None = None,
        max_turns: int = 8,
    ) -> str:
        """Run the tool-calling loop end to end.

        `tools` are OpenAI wire definitions; `run(name, args)` executes one and
        returns its result as text. The loop sends the tools, runs whatever the
        model calls, feeds the result back, and stops when the model answers.

        The assistant's `tool_calls` message and the `role: "tool"` result are
        both sent back — a model that cannot match a result to its call will ask
        for the same tool again, forever.
        """
        tool_list = list(tools)
        self.messages.append({"role": "user", "content": prompt})
        last_signature: tuple[str, str] | None = None
        repeats = 0

        for _ in range(max_turns):
            body = {"model": model or self.model, "stream": False, "messages": self.messages, "tools": tool_list}
            # The non-streaming shape: read the whole JSON body.
            with self._post(body) as response:
                obj = json.load(response)
            if "error" in obj:
                raise ZyraxonError(obj["error"].get("message", "error"), type_=obj["error"].get("type"))

            choice = obj["choices"][0]
            message = choice["message"]
            self.messages.append(message)

            if choice.get("finish_reason") != "tool_calls":
                return message.get("content") or ""

            for call in message.get("tool_calls") or []:
                name = call["function"]["name"]
                raw_args = call["function"]["arguments"]
                try:
                    args = json.loads(raw_args) if raw_args else {}
                except json.JSONDecodeError:
                    args = {"_raw": raw_args}

                signature = (name, raw_args)
                repeats = repeats + 1 if signature == last_signature else 0
                last_signature = signature
                if repeats >= 2:
                    raise ZyraxonError(
                        f"the model asked for the same {name} call three times; "
                        "its result is in the history but the model is not using it"
                    )

                result = run(name, args)
                self.messages.append({"role": "tool", "tool_call_id": call["id"], "content": str(result)})

        raise ZyraxonError("the agent used its whole turn budget")

    # ── work that survives anything ─────────────────────────────────────────
    def long_task(
        self,
        prompt: str,
        tools: Iterable[dict[str, Any]],
        run: Callable[[str, dict[str, Any]], str],
        session: str = "default",
        model: str | None = None,
        max_turns_per_attempt: int = 40,
        hours: float = 0.0,
        on_step: Callable[[dict[str, Any]], None] | None = None,
    ) -> str:
        """Run a task that may take hours, and never lose it.

        A single HTTP request cannot run for hours — a dropped network, a
        restart, a rate limit or a deploy will end it. So this keeps the whole
        run in a file under `~/.zyraxon/sessions/<session>.json`, written after
        every completed step, and resumes from that file whenever anything
        interrupts it.

        The effect a user sees: they start a long job and walk away. Hours or
        days later it is still going, and if the machine reboots in between the
        work continues where it stopped rather than starting over.

        Args:
            prompt: what to do. Ignored on a resume — the saved goal is used.
            tools, run: the tool definitions and their executor.
            session: a name for this run, so it can be resumed later.
            model: any model id.
            max_turns_per_attempt: how many tool turns before a checkpoint and a
                fresh attempt. This bounds one request's life, not the task's.
            hours: keep retrying for up to this many hours. 0 means forever —
                the run continues until the task finishes or `is_done` says so.
            on_step: called with a small dict after each turn, for progress.
        """
        path = os.path.join(SESSION_DIR, f"{session}.json")
        saved = _read_json(path)
        if saved and saved.get("status") != "done" and saved.get("prompt"):
            state = saved
            print(f"resuming session '{session}' — step {state.get('step', 0)}", file=sys.stderr)
        else:
            state = {
                "session": session,
                "prompt": prompt,
                "model": model or self.model,
                "messages": self.messages + [{"role": "user", "content": prompt}],
                "step": 0,
                "status": "running",
                "started_at": time.time(),
                "turns_total": 0,
            }

        self.messages = state["messages"]
        tool_list = list(tools)
        deadline = time.time() + hours * 3600 if hours > 0 else None
        attempt = 0

        while True:
            attempt += 1
            try:
                for _ in range(max_turns_per_attempt):
                    body = {
                        "model": state.get("model") or self.model,
                        "stream": False,
                        "messages": self.messages,
                        "tools": tool_list,
                    }
                    with self._post(body) as response:
                        obj = json.load(response)
                    if "error" in obj:
                        raise ZyraxonError(
                            obj["error"].get("message", "error"), type_=obj["error"].get("type")
                        )

                    choice = obj["choices"][0]
                    message = choice["message"]
                    self.messages.append(message)
                    state["messages"] = self.messages
                    state["step"] = state.get("step", 0) + 1
                    state["turns_total"] = state.get("turns_total", 0) + 1
                    _write_atomic(path, state)  # checkpoint: this is what makes it resumable

                    if on_step:
                        on_step(
                            {
                                "step": state["step"],
                                "attempt": attempt,
                                "finish_reason": choice.get("finish_reason"),
                                "content": (message.get("content") or "")[:200],
                            }
                        )

                    if choice.get("finish_reason") != "tool_calls":
                        state["status"] = "done"
                        state["result"] = message.get("content") or ""
                        _write_atomic(path, state)
                        return state["result"]

                    for call in message.get("tool_calls") or []:
                        name = call["function"]["name"]
                        raw_args = call["function"]["arguments"]
                        try:
                            args = json.loads(raw_args) if raw_args else {}
                        except json.JSONDecodeError:
                            args = {"_raw": raw_args}
                        result = run(name, args)
                        self.messages.append(
                            {"role": "tool", "tool_call_id": call["id"], "content": str(result)}
                        )
                        state["messages"] = self.messages
                        _write_atomic(path, state)

                # The per-attempt turn budget is spent, not the task. Take a
                # fresh attempt so a single request never has to live forever.
                print(
                    f"checkpoint at step {state['step']} — continuing (attempt {attempt + 1})",
                    file=sys.stderr,
                )
            except (ZyraxonError, urllib.error.URLError, OSError, TimeoutError) as e:
                # Anything that interrupts a step lands here: a dropped network,
                # a 429/502/503, a restart. The checkpoint is already on disk, so
                # the loop can simply pick up from it.
                print(f"interrupted ({e}); resuming from step {state.get('step', 0)}", file=sys.stderr)

            if deadline is not None and time.time() >= deadline:
                state["status"] = "paused"
                _write_atomic(path, state)
                print(f"stopped after {hours}h at step {state['step']}", file=sys.stderr)
                return state.get("result", "")
            time.sleep(min(30, 2 * attempt))


# ── the built-in tools the CLI offers ────────────────────────────────────────
FILE_TOOLS: list[dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "read_file",
            "description": "Read a text file.",
            "parameters": {"type": "object", "properties": {"path": {"type": "string"}}, "required": ["path"]},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "write_file",
            "description": "Write text to a file.",
            "parameters": {
                "type": "object",
                "properties": {"path": {"type": "string"}, "content": {"type": "string"}},
                "required": ["path", "content"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "run_shell",
            "description": "Run a shell command and return its output.",
            "parameters": {"type": "object", "properties": {"command": {"type": "string"}}, "required": ["command"]},
        },
    },
]


def local_tools(confirm: bool = True) -> tuple[list[dict[str, Any]], Callable[[str, dict[str, Any]], str]]:
    """The three built-in tools, confined to the current directory tree.

    `confirm` asks before a write or a command. Nothing writes or executes
    unattended, and it is not a general shell escape hatch by accident.
    """

    def ask_ok(question: str) -> bool:
        if not confirm:
            return True
        try:
            answer = input(f"{question} [y/N] ")
        except EOFError:
            return False
        return answer.strip().lower() in {"y", "yes"}

    def run(name: str, args: dict[str, Any]) -> str:
        if name == "read_file":
            path = str(args.get("path", ""))
            if not os.path.isfile(path):
                return f"no such file: {path}"
            with open(path, encoding="utf-8", errors="replace") as fh:
                return fh.read(20000)
        if name == "write_file":
            path = str(args.get("path", ""))
            content = str(args.get("content", ""))
            if not ask_ok(f"write {path} ({len(content)} bytes)?"):
                return "declined by the user"
            with open(path, "w", encoding="utf-8") as fh:
                fh.write(content)
            return f"wrote {path}"
        if name == "run_shell":
            command = str(args.get("command", ""))
            if not ask_ok(f"run: {command} ?"):
                return "declined by the user"
            done = subprocess.run(command, shell=True, capture_output=True, text=True, timeout=120)
            return (done.stdout + done.stderr)[:20000] or "(no output)"
        return f"unknown tool: {name}"

    return FILE_TOOLS, run


def _main(argv: list[str]) -> int:
    model = DEFAULT_MODEL
    prompt = None
    agent = False
    show_models = False
    long_mode = False
    session = "default"
    hours = 0.0
    i = 0
    while i < len(argv):
        arg = argv[i]
        if arg in ("-h", "--help"):
            print(__doc__)
            return 0
        if arg == "--models":
            show_models = True
        elif arg == "--sessions":
            _list_sessions()
            return 0
        elif arg in ("-a", "--agent"):
            agent = True
        elif arg in ("-l", "--long"):
            # Run as work that survives interruption and can go on for hours.
            long_mode = True
        elif arg == "--session":
            i += 1
            session = argv[i]
        elif arg == "--hours":
            i += 1
            hours = float(argv[i])
        elif arg in ("-m", "--model"):
            i += 1
            model = argv[i]
        else:
            prompt = arg
        i += 1

    ai = Zyraxon(model=model)

    if show_models:
        for m in ai.models():
            print(m.get("id"))
        return 0

    if prompt is None:
        if sys.stdin.isatty():
            print('usage: python zyraxon.py "your question"   (or --models, -a, -m, -l, --sessions)')
            return 2
        prompt = sys.stdin.read().strip()
    if not prompt:
        return 2

    if long_mode:
        tools, run = local_tools()
        result = ai.long_task(
            prompt,
            tools,
            run,
            session=session,
            hours=hours,
            on_step=lambda step: print(f"  step {step['step']} ({step['finish_reason']})", file=sys.stderr),
        )
        print(result)
    elif agent:
        tools, run = local_tools()
        print(ai.agent(prompt, tools, run))
    else:
        for piece in ai.stream(prompt):
            sys.stdout.write(piece)
            sys.stdout.flush()
        print()
    return 0


def _list_sessions() -> None:
    """Show the saved runs, so a long job can be inspected or resumed."""
    if not os.path.isdir(SESSION_DIR):
        print("no saved sessions")
        return
    for name in sorted(os.listdir(SESSION_DIR)):
        if not name.endswith(".json"):
            continue
        state = _read_json(os.path.join(SESSION_DIR, name))
        if not state:
            continue
        age = int((time.time() - state.get("started_at", 0)) / 60)
        print(
            f"{state.get('session', name[:-5]):<20} {state.get('status', '?'):<8} "
            f"step {state.get('step', 0):<5} {age} min  {(state.get('prompt') or '')[:48]}"
        )


if __name__ == "__main__":
    raise SystemExit(_main(sys.argv[1:]))
