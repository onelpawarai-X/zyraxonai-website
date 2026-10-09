import { createFileRoute, Link } from "@tanstack/react-router";

const REPO = "https://github.com/onelpawarai-X/SWE-bench-Lite-ZYRAXON-AI";
const PAPER = "/swebench/zyraxon-swebench-lite.pdf";
const PAPER_TEX = "/swebench/zyraxon-swebench-lite.tex";
const SITE = "https://zyraxonai.lovable.app/swebench-lite";
const POLICY = "https://github.com/swe-bench/experiments#-swe-bench-lite-verified-multilingual";

// ---------------------------------------------------------------------------
// Author data. `affiliation` is the academic/research institution that the
// SWE-bench Verified leaderboard requires from at least one author; SWE-bench
// Lite has no such requirement, so a single independent author is sufficient.
// ---------------------------------------------------------------------------
type Person = {
  name: string;
  native?: string;
  role: string;
  org: string;
  affiliation?: string;
  note: string;
  link?: string;
  email?: string;
};

const FIRST_AUTHOR: Person = {
  name: "Deluar Husen Sayidi",
  native: "দেলোয়ার হুসেন সাইদি",
  role: "Author · Corresponding",
  org: "ZYRAXON AI, Inc.",
  note: "Designed the ZYRAXON-AI agent, built the evaluation harness and produced the results reported here.",
  link: "https://github.com/onelpawarai-X",
};

// SWE-bench Lite does not require a co-author or an academic affiliation.
const COAUTHORS: Person[] = [];

const HAS_AFFILIATION = [FIRST_AUTHOR, ...COAUTHORS].some((p) => !!p.affiliation);

export const Route = createFileRoute("/swebench-lite")({
  head: () => ({
    meta: [
      { title: "SWE-bench Lite — ZYRAXON-AI Technical Report" },
      {
        name: "description",
        content:
          "ZYRAXON-AI resolves 290/300 (96.67%) of SWE-bench Lite with the official Docker grader. Full methodology, results, and independent verification instructions.",
      },
      { property: "og:title", content: "SWE-bench Lite — ZYRAXON-AI Technical Report" },
      {
        property: "og:description",
        content:
          "96.67% resolved on SWE-bench Lite (290/300). Real Docker grading, no web lookup, fully re-derivable verdicts.",
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
          headline: "ZYRAXON-AI — SWE-bench Lite Technical Report",
          author: [FIRST_AUTHOR, ...COAUTHORS].map((p) => ({
            "@type": "Person",
            name: p.name,
            ...(p.affiliation ? { affiliation: { "@type": "Organization", name: p.affiliation } } : {}),
          })),
          publisher: { "@type": "Organization", name: "ZYRAXON AI, Inc." },
          about: "SWE-bench Lite",
        }),
      },
    ],
  }),
  component: SwePage,
});

type Row = [string, number, number];

const BY_REPO: Row[] = [
  ["django/django", 112, 114],
  ["sympy/sympy", 74, 77],
  ["scikit-learn/scikit-learn", 23, 23],
  ["matplotlib/matplotlib", 22, 23],
  ["pytest-dev/pytest", 16, 17],
  ["sphinx-doc/sphinx", 14, 16],
  ["astropy/astropy", 6, 6],
  ["psf/requests", 6, 6],
  ["pylint-dev/pylint", 6, 6],
  ["pydata/xarray", 5, 5],
  ["mwaskom/seaborn", 4, 4],
  ["pallets/flask", 2, 3],
];

const BY_YEAR: Row[] = [
  ["2012", 1, 1],
  ["2014", 3, 3],
  ["2015", 1, 1],
  ["2016", 4, 4],
  ["2017", 15, 16],
  ["2018", 21, 21],
  ["2019", 58, 59],
  ["2020", 62, 66],
  ["2021", 40, 42],
  ["2022", 56, 57],
  ["2023", 29, 30],
];

const MODELS = ["deepseek-v4.1-flash", "deepseek-v4-flash"];

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
            Technical Report · SWE-bench Lite
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
            ZYRAXON-AI resolves <span className="text-cyan-600">96.67%</span> of SWE-bench Lite
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-600">
            A fully local desktop coding agent. 290 of 300 real GitHub issues resolved under the
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
              ["Resolved", "290 / 300"],
              ["Resolved rate", "96.67%"],
              ["Instances graded", "300"],
              ["Verdicts re-derived", "300 / 300"],
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
          {[FIRST_AUTHOR, ...COAUTHORS].map((p) => (
            <div key={p.name} className="rounded-2xl border border-slate-200 bg-white p-6">
              <p className="text-xs font-bold tracking-widest text-cyan-600 uppercase">{p.role}</p>
              <h3 className="mt-2 text-xl font-bold text-slate-900">{p.name}</h3>
              {p.native && <p className="mt-1 text-sm text-slate-500">{p.native}</p>}
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{p.note}</p>
              <p className="mt-3 text-sm text-slate-600">
                {p.affiliation ? (
                  <>
                    <strong>{p.affiliation}</strong>
                    <br />
                  </>
                ) : null}
                {p.org}
                {p.link && (
                  <>
                    <br />
                    <a
                      className="text-cyan-700 underline"
                      href={p.link}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {p.link.replace(/^https?:\/\//, "")}
                    </a>
                  </>
                )}
                {p.email && (
                  <>
                    <br />
                    <a className="text-cyan-700 underline" href={`mailto:${p.email}`}>
                      {p.email}
                    </a>
                  </>
                )}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-2xl border border-cyan-200 bg-cyan-50 p-6">
          <p className="text-xs font-bold tracking-widest text-cyan-700 uppercase">
            Submission policy
          </p>
          <p className="mt-2 text-sm leading-relaxed text-cyan-900">
            SWE-bench Lite is the 300-instance subset used for the{" "}
            <a className="underline" href={POLICY} target="_blank" rel="noopener noreferrer">
              experiments leaderboard
            </a>
            . It does not require an academic co-author or an institutional affiliation, so this
            submission lists a single independent author and provides a public technical report.
          </p>
        </div>

        <div className="mt-12 rounded-2xl border border-amber-300 bg-amber-50 p-6">
          <h2 className="text-sm font-bold tracking-wide text-amber-900 uppercase">
            Honesty note — this is best-of-2, not pass@1
          </h2>
          <p className="mt-2 text-[15px] leading-relaxed text-amber-900">
            When a model turn fails for infrastructure reasons (timeout or dropped connection), the
            harness rotates to a different model and retries once.{" "}
            <strong>105 of the 300 instances used the second attempt.</strong> We therefore report
            this run as best-of-2 and set the leaderboard field{" "}
            <code className={CODE}>system.attempts</code> to <code className={CODE}>"2+"</code>. No
            benchmark test knowledge is used to choose between attempts.
          </p>
        </div>

        <h2 className={H2}>What ZYRAXON-AI is</h2>
        <p className={P}>
          ZYRAXON-AI is not a chatbot and not a benchmark-specific scaffold. It is a desktop
          application — Electron 42 + SolidJS + Bun — that runs entirely on the user's machine,
          exposes a large local tool surface, and acts on local files, commands and projects. The
          same tool surface that lets it refactor a local project is what lets it fix a real GitHub
          issue. It runs a local server on <code className={CODE}>127.0.0.1:4096</code> and drives
          language models from the <strong>OpenCode Zen</strong> provider.
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
          The provider is queried live and the model rotates on failure. Because more than one model
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
          The 10 unresolved instances concentrate in <code className={CODE}>sympy</code> (3),{" "}
          <code className={CODE}>django</code> (2) and <code className={CODE}>sphinx</code> (2), with
          one each in <code className={CODE}>matplotlib</code>, <code className={CODE}>pytest</code>{" "}
          and <code className={CODE}>flask</code>. Three failure modes dominate: wrong-but-plausible
          fixes that break a P2P test, incomplete edits that touch one of several required locations,
          and a small number of environment-specific test failures unrelated to the patch logic.
          These are reported as-is.
        </p>

        <h2 className={H2}>Verify it yourself</h2>
        <p className={P}>
          Nothing here is taken on trust. Every verdict is bound to the exact patch and re-derivable
          from the published raw test output. We re-graded all 300 instances from the published
          artifacts and got <strong>300/300 matches, 0 mismatches</strong>.
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
        load_swebench_dataset("princeton-nlp/SWE-bench_Lite", "test")}
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
print("matched:", matched)   # -> 300`}
        </pre>

        <h3 className="mt-6 text-lg font-semibold text-slate-900">
          2. Re-run the official harness with Docker
        </h3>
        <pre className="mt-2 overflow-x-auto rounded-xl bg-slate-900 p-4 text-xs leading-relaxed text-slate-100">
{`pip install swebench==3.0.12
python -m swebench.harness.run_evaluation \\
  --dataset_name princeton-nlp/SWE-bench_Lite \\
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
            • <code className={CODE}>all_preds.jsonl</code> — 300 predictions
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
{`@techreport{zyraxon2026swebenchlite,
  title  = {ZYRAXON-AI: A Fully Local Desktop Coding Agent that
            Resolves 96.67% of SWE-bench Lite},
  author = {Deluar Husen Sayidi},
  year   = {2026},
  url    = {https://github.com/onelpawarai-X/SWE-bench-Lite-ZYRAXON-AI}
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