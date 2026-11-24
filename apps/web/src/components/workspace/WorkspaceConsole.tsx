import { ChevronDown, ChevronUp, FlaskConical, Terminal } from "lucide-react";
import type { RunResponse, WorkspaceTestCase } from "@/lib/api";

export type ConsoleTab = "output" | "tests";

export function formatValue(value: unknown) {
  return typeof value === "string" ? value : JSON.stringify(value, null, 2) ?? "—";
}

function GroupSummary({ label, tests }: { label: string; tests: WorkspaceTestCase[] }) {
  if (!tests.length) return null;
  const passed = tests.filter((item) => item.passed).length;
  return <p className="workspace-test-group"><strong>{label}</strong><span>{passed}/{tests.length} passed</span></p>;
}

function TestDetails({ tests }: { tests: WorkspaceTestCase[] }) {
  return (
    <div className="flex flex-col gap-2">
      {tests.filter((item) => item.visible).map((item) => (
        <details key={item.index} className="workspace-case" open={item.passed ? undefined : true}>
          <summary><span>Example {item.index + 1}</span><span>{item.passed ? "Passed" : "Failed"}</span></summary>
          <dl className="workspace-case-values">
            <div><dt>Input</dt><dd>{formatValue(item.input)}</dd></div>
            <div><dt>Expected</dt><dd>{formatValue(item.expected)}</dd></div>
            <div><dt>Received</dt><dd>{formatValue(item.got)}</dd></div>
          </dl>
          {item.error && <p className="px-3 pb-3">{item.error.trim().split("\n").at(-1)}</p>}
        </details>
      ))}
      <GroupSummary label="Hidden tests" tests={tests.filter((item) => !item.visible && item.index < 2000)} />
      <GroupSummary label="Edge cases" tests={tests.filter((item) => !item.visible && item.index >= 2000)} />
    </div>
  );
}

export function WorkspaceConsole({ tab, open, note, run, tests, stale, onTab, onToggle }: {
  tab: ConsoleTab;
  open: boolean;
  note: string | null;
  run: RunResponse | null;
  tests: WorkspaceTestCase[];
  stale: boolean;
  onTab: (tab: ConsoleTab) => void;
  onToggle: () => void;
}) {
  const passed = tests.filter((test) => test.passed).length;
  return (
    <section className="workspace-console" aria-label="Execution feedback" data-open={open}>
      <div className="workspace-console-bar">
        <div className="workspace-console-tabs" role="group" aria-label="Console view">
          <button type="button" aria-pressed={open && tab === "output"} onClick={() => onTab("output")}><Terminal size={16} aria-hidden="true" />Output</button>
          <button type="button" aria-pressed={open && tab === "tests"} onClick={() => onTab("tests")}><FlaskConical size={16} aria-hidden="true" />Tests {tests.length > 0 && <span>{passed}/{tests.length}</span>}</button>
        </div>
        <button type="button" className="workspace-console-toggle" onClick={onToggle} aria-controls="workspace-feedback" aria-expanded={open} aria-label={open ? "Collapse console" : "Expand console"}>{open ? <ChevronDown size={19} aria-hidden="true" /> : <ChevronUp size={19} aria-hidden="true" />}</button>
      </div>
      <div id="workspace-feedback" className="workspace-console-content" hidden={!open}>
        {stale && (run || tests.length > 0) && <p className="workspace-console-note">This feedback is from before your latest edits.</p>}
        {note && <p className="workspace-console-status" role="status">{note}</p>}
        {tab === "output" ? (
          run ? <div className="flex flex-col gap-2">
            {run.ok && <div className="workspace-output"><strong>Return value</strong><pre>{formatValue(run.result)}</pre></div>}
            {run.stdout && <div className="workspace-output"><strong>Standard output</strong><pre>{run.stdout}</pre></div>}
            {run.ast_insights[0] && <p className="workspace-console-note">Code observation: {run.ast_insights[0]}</p>}
          </div> : !note && <p className="workspace-console-note">Run your code to see its return value, printed output, or errors.</p>
        ) : tests.length > 0 ? <TestDetails tests={tests} /> : !note && <p className="workspace-console-note">Submit runs visible examples plus private cases. All tests must pass before Viva.</p>}
      </div>
    </section>
  );
}
