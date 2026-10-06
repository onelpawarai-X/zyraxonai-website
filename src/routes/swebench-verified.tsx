import { createFileRoute, Link } from "@tanstack/react-router";

const REPO = "https://github.com/onelpawarai-X/SWE-bench-ZYRAXON-AI";
const PAPER = "/swebench/zyraxon-swebench-verified.pdf";
const PAPER_TEX = "/swebench/zyraxon-swebench-verified.tex";
const SITE = "https://zyraxonai.lovable.app/swebench-verified";
const POLICY = "https://github.com/swe-bench/experiments#-swe-bench-lite-verified-multilingual";

export const Route = createFileRoute("/swebench-verified")({
  head: () => ({
    meta: [
      { title: "SWE-bench Verified — ZYRAXON-AI Technical Report" },
      {
        name: "description",
        content:
          "ZYRAXON-AI v19.0.5 resolves 425/500 (85.0%) of SWE-bench Verified with the official Docker grader. Full methodology, results, and independent verification instructions.",
      },
      { property: "og:title", content: "SWE-bench Verified — ZYRAXON-AI Technical Report" },
      {
        property: "og:description",
        content:
          "85.0% resolved on SWE-bench Verified (425/500). Real Docker grading, no web lookup, fully re-derivable verdicts.",
      },
      { property: "og:type", content: "article" },
      { property: "og:image", content: "/zyraxon-logo.png" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "ScholarlyArticle",
          headline: "ZYRAXON-AI v19.0.5 — SWE-bench Verified Technical Report",
          author: { "@type": "Person", name: "Deluar Husen Sayidi" },
          publisher: { "@type": "Organization", name: "ZYRAXON AI, Inc." },
          about: "SWE-bench Verified",
        }),
      },
    ],
  }),
  component: SwePage,
});

type Row = [string, number, number];

const BY_REPO: Row[] = [
  ["django/django", 198, 231],
  ["sympy/sympy", 58, 75],
  ["sphinx-doc/sphinx", 38, 44],
  ["matplotlib/matplotlib", 30, 34],
  ["scikit-learn/scikit-learn", 30, 32],
  ["pydata/xarray", 20, 22],
  ["pytest-dev/pytest", 18, 19],
  ["astropy/astropy", 16, 22],
  ["psf/requests", 7, 8],
  ["pylint-dev/pylint", 7, 10],
  ["mwaskom/seaborn", 2, 2],
  ["pallets/flask", 1, 1],
];

const BY_YEAR: Row[] = [
  ["2013", 2, 3],
  ["2014", 2, 2],
  ["2015", 0, 1],
  ["2016", 2, 2],
  ["2017", 5, 16],
  ["2018", 20, 24],
  ["2019", 47, 98],
  ["2020", 38, 108],
  ["2021", 30, 86],
  ["2022", 89, 102],
  ["2023", 51, 58],
];

const MODELS = [
  "space-bunny-free",
  "big-pickle",
  "nemotron-3.5-lightning-free",
  "fledge-alpha-free",
  "nemotron-3-ultra-free",
  "mimo-v2.6-flash-free",
];

const H2 = "mt-12 text-2xl font-bold tracking-tight text-slate-900";
const P = "mt-3 text-[15px] leading-relaxed text-slate-600";
const CODE = "rounded bg-slate-100 px-1";

function Bar({ r }: { r: Row }) {
  const pct = (r[1] / r[2]) * 100;
  return (
    <div className="py-2">
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium text-slate-800">{r[0]}</span>
        <span className="tabular-nums text-slate-500">
          {r[1]}/{r[2]} · {pct.toFixed(1)}%
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-cyan-600"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function SwePage() {
  return (
    <main className="min-h-screen bg-white text-slate-900">
      <section className="border-b border-slate-200 bg-gradient-to-b from-slate-50 to-white">
        <div className="mx-auto max-w-4xl px-5 py-14">
          <Link to="/" className="text-sm text-slate-500 hover:text-slate-900">
            ← ZYRAXON AI
          </Link>
          <p className="mt-6 text-xs font-bold tracking-[0.18em] text-cyan-600 uppercase">
            Technical Report · SWE-bench Verified
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
            ZYRAXON-AI v19.0.5 resolves <span className="text-cyan-600">85.0%</span> of SWE-bench
            Verified
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-600">
            A fully local desktop coding agent. 425 of 500 real GitHub issues resolved under the
            official SWE-bench Docker grader — with no web access to solutions and no use of
            benchmark test metadata.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href={PAPER}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
            >
              Read the paper (PDF)
            </a>
            <a
              href={PAPER}
              download
              className="rounded-lg bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-700"
            >
              Download PDF
            </a>
            <a
              href={REPO}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-800 transition hover:border-slate-400"
            >
              Artifacts on GitHub
            </a>
            <a
              href={PAPER_TEX}
              className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-800 transition hover:border-slate-400"
            >
              LaTeX source
            </a>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-4">
            {[
              ["Resolved", "425 / 500"],
              ["Resolved rate", "85.0%"],
              ["Instances graded", "500"],
              ["Verdicts re-derived", "500 / 500"],
            ].map(([k, v]) => (
              <div key={k} className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="text-2xl font-bold tracking-tight text-slate-900">{v}</div>
                <div className="mt-1 text-xs font-medium tracking-wide text-slate-500 uppercase">
                  {k}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-4xl px-5 pb-24">
        <h2 className="mt-12 text-2xl font-bold tracking-tight text-slate-900">
          Authors &amp; Affiliations
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <p className="text-xs font-bold tracking-widest text-cyan-600 uppercase">
              First author · Corresponding
            </p>
            <h3 className="mt-2 text-xl font-bold text-slate-900">Deluar Husen Sayidi</h3>
            <p className="mt-1 text-sm text-slate-500">দেলোয়ার হুসেন সাইদি</p>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              First and corresponding author. Designed the ZYRAXON-AI agent, built the evaluation
              harness and produced the results reported here.
            </p>
            <p className="mt-3 text-sm text-slate-600">
              ZYRAXON AI, Inc.
              <br />
              <a
                className="text-cyan-700 underline"
                href="https://github.com/onelpawarai-X"
                target="_blank"
                rel="noopener noreferrer"
              >
                github.com/onelpawarai-X
              </a>
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <p className="text-xs font-bold tracking-widest text-cyan-600 uppercase">Organization</p>
            <h3 className="mt-2 text-xl font-bold text-slate-900">ZYRAXON AI, Inc.</h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              The organization behind ZYRAXON-AI — a free, open-source desktop AI agent. It provides
              the system, the tooling and the public artifacts for this submission.
            </p>
            <p className="mt-3 text-sm text-slate-600">
              <a
                className="text-cyan-700 underline"
                href="https://github.com/onelpawarai-X/ZYRAXON-AI"
                target="_blank"
                rel="noopener noreferrer"
              >
                ZYRAXON-AI on GitHub
              </a>
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6">
            <p className="text-xs font-bold tracking-widest text-slate-500 uppercase">
              Co-authors &amp; contributors
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Additional co-authors and contributors are being finalized and will be listed here and
              in <code className={CODE}>metadata.yaml</code> before the leaderboard submission is
              opened.
            </p>
          </div>
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6">
            <p className="text-xs font-bold tracking-widest text-slate-500 uppercase">
              Academic / research affiliation
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              SWE-bench Verified now requires at least one author affiliated with an academic
              institution or established research lab. The affiliation is being finalized and will
              appear here and in <code className={CODE}>metadata.yaml</code>.
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-cyan-200 bg-cyan-50 p-6">
          <p className="text-xs font-bold tracking-widest text-cyan-700 uppercase">
            Leaderboard policy
          </p>
          <p className="mt-2 text-sm leading-relaxed text-cyan-900">
            As of 18 November 2025, SWE-bench Verified accepts submissions only from academic teams
            and research institutions with an open research publication (arXiv preprint or technical
            report) and at least one author affiliated with an academic institution or established
            research lab.{" "}
            <a className="underline" href={POLICY} target="_blank" rel="noopener noreferrer">
              Read the policy
            </a>
            . This submission provides the technical report (below) and is finalizing its academic
            affiliation.
          </p>
        </div>

        <div className="mt-12 rounded-2xl border border-amber-300 bg-amber-50 p-6">
          <h2 className="text-sm font-bold tracking-wide text-amber-900 uppercase">
            Honesty note — this is best-of-2, not pass@1
          </h2>
          <p className="mt-2 text-[15px] leading-relaxed text-amber-900">
            When a model turn fails for infrastructure reasons (timeout or dropped connection), the
            harness rotates to a different model and retries once.{" "}
            <strong>174 of the 500 instances used the second attempt.</strong> We therefore report
            this run as best-of-2 and set the leaderboard field{" "}
            <code className={CODE}>system.attempts</code> to <code className={CODE}>"2+"</code>. No
            benchmark test knowledge is used to choose between attempts.
          </p>
        </div>

        <h2 className={H2}>What ZYRAXON-AI is</h2>
        <p className={P}>
          ZYRAXON-AI is not a chatbot and not a benchmark-specific scaffold. It is a desktop
          application — Electron 42 + SolidJS + Bun 1.3.14 — that runs entirely on the user's
          machine, exposes 805 tools across 63 categories, and acts on local files, commands and
          projects. The same tool surface that lets it refactor a local project is what lets it fix a
          real GitHub issue. It runs a local server on <code className={CODE}>127.0.0.1:4096</code>{" "}
          and drives language models from the <strong>OpenCode Zen</strong> provider.
        </p>

        <h2 className={H2}>Integrity constraints</h2>
        <ul className="mt-3 space-y-2 text-[15px] leading-relaxed text-slate-600">
          <li>
            • <strong>No web browsing.</strong> The solver cannot reach GitHub, mirrors of the fixes,
            or any SWE-bench source.
          </li>
          <li>
            • <strong>No test knowledge.</strong> <code className={CODE}>FAIL_TO_PASS</code> and{" "}
            <code className={CODE}>PASS_TO_PASS</code> are read only by the grader, after the patch
            is frozen.
          </li>
          <li>
            • <strong>No hints.</strong> The <code className={CODE}>hints</code> field is never
            passed to the agent.
          </li>
          <li>
            • <strong>Fresh checkout per attempt.</strong> A retry starts from the base commit again.
          </li>
        </ul>

        <h2 className={H2}>Models actually used</h2>
        <p className={P}>
          The provider is queried live and models rotate on failure. Because more than one model
          produced patches, the leaderboard reports{" "}
          <code className={CODE}>model_display: Multiple</code>.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {MODELS.map((m) => (
            <span
              key={m}
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 font-mono text-xs text-slate-700"
            >
              {m}
            </span>
          ))}
        </div>

        <h2 className={H2}>Results by repository</h2>
        <div className="mt-3 grid gap-x-10 gap-y-1 sm:grid-cols-2">
          {BY_REPO.map((r) => (
            <Bar key={r[0]} r={r} />
          ))}
        </div>

        <h2 className={H2}>Results by issue year</h2>
        <div className="mt-3 grid gap-x-10 gap-y-1 sm:grid-cols-2">
          {BY_YEAR.map((r) => (
            <Bar key={r[0]} r={r} />
          ))}
        </div>

        <h2 className={H2}>Failure analysis</h2>
        <p className={P}>
          The 75 unresolved instances concentrate in <code className={CODE}>sympy</code> (17) and{" "}
          <code className={CODE}>django</code> (33). Three failure modes dominate: wrong-but-plausible
          fixes that break a P2P test, incomplete edits that touch one of several required locations,
          and a small number of environment-specific test failures unrelated to the patch logic.
          These are reported as-is.
        </p>

        <h2 className={H2}>Verify it yourself</h2>
        <p className={P}>
          Nothing here is taken on trust. Every verdict is bound to the exact patch and re-derivable
          from the published raw test output. We re-graded all 500 instances from the published
          artifacts and got <strong>500/500 matches, 0 mismatches</strong>.
        </p>

        <h3 className="mt-6 text-lg font-semibold text-slate-900">
          1. Re-derive all verdicts without Docker
        </h3>
        <pre className="mt-2 overflow-x-auto rounded-xl bg-slate-900 p-4 text-xs leading-relaxed text-slate-100">
{`import gzip, json, os
from swebench.harness.utils import load_swebench_dataset
from swebench.harness.test_spec.test_spec import make_test_spec
from swebench.harness.grading import get_eval_report

res = set(json.load(open("results/results.json"))["resolved"])
data = {x["instance_id"]: x for x in
        load_swebench_dataset("SWE-bench/SWE-bench_Verified", "test")}
matched = 0
for iid in os.listdir("logs"):
    d = os.path.join("logs", iid)
    if not os.path.isdir(d) or "__" not in iid: continue
    spec = make_test_spec(data[iid])
    pred = {"instance_id": iid, "model_name_or_path": "multiple",
            "model_patch": open(os.path.join(d, "patch.diff")).read()}
    open("/tmp/log.txt","w").write(
        gzip.open(os.path.join(d, "test_output.txt.gz"), "rt").read())
    r = get_eval_report(spec, pred, "/tmp/log.txt", True)[iid]["resolved"]
    matched += (r == (iid in res))
print("matched:", matched)   # -> 500`}
        </pre>

        <h3 className="mt-6 text-lg font-semibold text-slate-900">
          2. Re-run the official harness with Docker
        </h3>
        <pre className="mt-2 overflow-x-auto rounded-xl bg-slate-900 p-4 text-xs leading-relaxed text-slate-100">
{`pip install swebench==3.0.12
python -m swebench.harness.run_evaluation \\
  --dataset_name SWE-bench/SWE-bench_Verified \\
  --predictions_path all_preds.jsonl \\
  --max_workers 4 --run_id zyraxon_check`}
        </pre>

        <h2 className={H2}>Artifacts</h2>
        <ul className="mt-3 space-y-2 text-[15px] leading-relaxed text-slate-600">
          <li>
            •{" "}
            <a className="text-cyan-700 underline" href={REPO} target="_blank" rel="noopener noreferrer">
              GitHub repository
            </a>{" "}
            — predictions, logs, traces, results
          </li>
          <li>
            • <a className="text-cyan-700 underline" href={PAPER}>Technical report (PDF)</a>
          </li>
          <li>
            • <a className="text-cyan-700 underline" href={PAPER_TEX}>LaTeX source</a>
          </li>
          <li>
            • <code className={CODE}>all_preds.jsonl</code> — 500 predictions
          </li>
          <li>
            • <code className={CODE}>logs/&lt;instance_id&gt;/</code> — patch, verdict, raw test
            output
          </li>
          <li>
            • <code className={CODE}>trajs/&lt;instance_id&gt;.jsonl</code> — reasoning traces
          </li>
        </ul>

        <h2 className={H2}>Citation</h2>
        <pre className="mt-2 overflow-x-auto rounded-xl bg-slate-50 p-4 text-xs leading-relaxed text-slate-700">
{`@techreport{zyraxon2026swebench,
  title  = {ZYRAXON-AI v19.0.5: A Fully Local Desktop Coding Agent that
            Resolves 85.0% of SWE-bench Verified},
  author = {Deluar Husen Sayidi and the ZYRAXON AI Team},
  year   = {2026},
  url    = {https://github.com/onelpawarai-X/SWE-bench-ZYRAXON-AI}
}`}
        </pre>

        <div className="mt-14 rounded-2xl border border-slate-200 bg-slate-50 p-6">
          <p className="text-sm text-slate-600">
            Prepared by <strong>Deluar Husen Sayidi</strong>, ZYRAXON AI, Inc. This report was written with
            the assistance of an AI agent and reviewed before publication.
          </p>
        </div>
      </div>
    </main>
  );
}
