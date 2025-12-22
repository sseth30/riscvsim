import "./style.css";
import { createSession, assemble, reset, step } from "./sim/api";
import type { Effect, ApiResponse } from "./sim/types";
import { formatEffects, changedRegsFromEffects, renderRegsTable } from "./sim/ui";

const defaultSource = `
#sym num=1000
#sym numPtr=1004

addi t0, zero, 5
addi t1, zero, 1000
sw   t0, 0(t1)      # num = 5

addi t2, zero, 1000
addi t3, zero, 1004
sw   t2, 0(t3)      # numPtr = &num

lw   t4, 0(t3)      # t4 = numPtr
addi t5, zero, 6
sw   t5, 0(t4)      # *numPtr = 6
`.trim();

let sessionId = "";
let regs = new Int32Array(32);
let lastEffects: Effect[] = [];
let halted = false;
let clike = "";
let rv2c = "";
let pc = 0;

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <div class="page">
    <h2 class="title">riscvsim</h2>

    <div class="grid">
      <div class="panel">
        <textarea id="src" spellcheck="false"></textarea>

        <div class="buttons">
          <button id="assemble">Assemble</button>
          <button id="reset">Reset</button>
          <button id="step">Step</button>
        </div>

        <h3>Step effects</h3>
        <div id="out" class="effects"></div>

        <h3>RISC-V → C mapping</h3>
        <pre id="c"></pre>

        <h3>C-like explanation</h3>
        <pre id="clike"></pre>
      </div>

      <div class="panel">
        <h3>Registers</h3>
        <div id="regs"></div>
      </div>
    </div>
  </div>
`;

const srcEl = document.querySelector<HTMLTextAreaElement>("#src")!;
const outEl = document.querySelector<HTMLDivElement>("#out")!;
const cEl = document.querySelector<HTMLPreElement>("#c")!;
const clikeEl = document.querySelector<HTMLPreElement>("#clike")!;
const regsEl = document.querySelector<HTMLDivElement>("#regs")!;

srcEl.value = defaultSource;

function applyResponse(r: ApiResponse) {
  if (r.error) {
    outEl.innerHTML = `<div class="muted">${r.error}</div>`;
    return;
  }

  if (r.sessionId) sessionId = r.sessionId;
  if (typeof r.pc === "number") pc = r.pc;
  if (Array.isArray(r.regs)) regs = Int32Array.from(r.regs);
  if (Array.isArray(r.effects)) lastEffects = r.effects;
  if (typeof r.halted === "boolean") halted = r.halted;

  if (typeof r.clike === "string") clike = r.clike;
  if (typeof r.rv2c === "string") rv2c = r.rv2c;
}

function renderAll() {
  cEl.textContent = rv2c;
  clikeEl.textContent = clike;

  outEl.innerHTML = formatEffects(lastEffects) + (halted ? `<div class="muted">HALTED</div>` : "");
  const changed = changedRegsFromEffects(lastEffects);
  regsEl.innerHTML = renderRegsTable(changed, regs);
}

async function boot() {
  outEl.innerHTML = `<div class="muted">Starting backend session...</div>`;
  const r = await createSession(srcEl.value);
  applyResponse(r);
  renderAll();
}

document.querySelector<HTMLButtonElement>("#assemble")!.onclick = async () => {
  if (!sessionId) return;
  lastEffects = [];
  outEl.innerHTML = `<div class="muted">Assembling...</div>`;
  const r = await assemble(sessionId, srcEl.value);
  applyResponse(r);
  renderAll();
};

document.querySelector<HTMLButtonElement>("#reset")!.onclick = async () => {
  if (!sessionId) return;
  lastEffects = [];
  const r = await reset(sessionId);
  applyResponse(r);
  renderAll();
};

document.querySelector<HTMLButtonElement>("#step")!.onclick = async () => {
  if (!sessionId) return;
  if (halted) return;
  const r = await step(sessionId);
  applyResponse(r);
  renderAll();
};

boot();
