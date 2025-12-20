import "./style.css";
import { parseProgram } from "./sim/parser";
import { createState, step } from "./sim/cpu";
import { rvToC } from "./sim/rv2c";
import { cLikeExplain } from "./sim/clike";
import type { Effect, Program } from "./sim/types";

const defaultSource = `
addi sp, sp, -4
addi t0, zero, 42
sw   t0, 0(sp)
lw   a0, 0(sp)
`.trim();

const abiNames = [
  "zero","ra","sp","gp","tp","t0","t1","t2","s0/fp","s1",
  "a0","a1","a2","a3","a4","a5","a6","a7",
  "s2","s3","s4","s5","s6","s7","s8","s9","s10","s11",
  "t3","t4","t5","t6"
];


function leWord(bytes: number[]) {
  const v =
    (bytes[0] | 0) |
    ((bytes[1] | 0) << 8) |
    ((bytes[2] | 0) << 16) |
    ((bytes[3] | 0) << 24);
  return v | 0; // signed 32-bit
}


function regLabel(i: number) {
  return `x${i} (${abiNames[i]})`;
}

function formatEffects(effects: Effect[]) {
  if (!effects.length) return `<div class="muted">(no changes)</div>`;

  const items = effects.map((e) => {
    if (e.kind === "reg") {
      return `
        <div class="row">
          <span class="tag">REG</span>
          <span class="mono">${regLabel(e.reg)}</span>
          <span class="mono">${e.before} → ${e.after}</span>
          <span class="mono">(${hex32(e.before)} → ${hex32(e.after)})</span>
        </div>
      `;
    }

    if (e.kind === "pc") {
      return `
        <div class="row">
          <span class="tag">PC</span>
          <span class="mono">${hex32(e.before)} → ${hex32(e.after)}</span>
        </div>
      `;
    }

    if (e.kind === "mem") {
      const beforeWord = leWord(e.before);
      const afterWord = leWord(e.after);
      const beforeBytes = e.before.map((b) => b.toString(16).padStart(2, "0")).join(" ");
      const afterBytes = e.after.map((b) => b.toString(16).padStart(2, "0")).join(" ");
      return `
        <div class="row">
          <span class="tag">MEM</span>
          <span class="mono">[${hex32(e.addr)}..${hex32(e.addr + e.size - 1)}]</span>
          <span class="mono">${beforeBytes} → ${afterBytes}</span>
          <span class="mono">(${beforeWord} → ${afterWord})</span>
        </div>
      `;
    }

    return `<div class="row">(unknown effect)</div>`;
  });

  return `<div class="effectsList">${items.join("")}</div>`;
}

function hex32(n: number) {
  return "0x" + (n >>> 0).toString(16).padStart(8, "0");
}

function bin32(n: number) {
  return (n >>> 0).toString(2).padStart(32, "0");
}

function changedRegsFromEffects(effects: Effect[]) {
  const set = new Set<number>();
  for (const e of effects) if (e.kind === "reg") set.add(e.reg);
  return set;
}

function renderRegsTable(changed: Set<number>, regs: Int32Array) {
  let html = `<table class="reg-table">
    <thead>
      <tr>
        <th>Register</th>
        <th>Decimal</th>
        <th>Hex</th>
        <th>Binary</th>
      </tr>
    </thead>
    <tbody>
  `;

  for (let i = 0; i < 32; i++) {
    const v = regs[i] | 0;
    const cls = changed.has(i) ? "changed" : "";
    html += `
      <tr class="${cls}">
        <td>x${i} (${abiNames[i]})</td>
        <td>${v}</td>
        <td>${hex32(v)}</td>
        <td class="mono">${bin32(v)}</td>
      </tr>
    `;
  }

  html += `</tbody></table>`;
  return html;
}

let state = createState();
let program: Program = parseProgram(defaultSource);
let lastEffects: Effect[] = [];

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
const regsEl = document.querySelector<HTMLDivElement>("#regs")!;
const clikeEl = document.querySelector<HTMLPreElement>("#clike")!;

srcEl.value = defaultSource;

function renderAll() {
  cEl.textContent = rvToC(program);
  clikeEl.textContent = cLikeExplain(program);

  outEl.innerHTML = formatEffects(lastEffects);

  const changed = changedRegsFromEffects(lastEffects);
  regsEl.innerHTML = renderRegsTable(changed, state.regs);
}



document.querySelector<HTMLButtonElement>("#assemble")!.onclick = () => {
  try {
    program = parseProgram(srcEl.value);
    state = createState();
    lastEffects = [];
    renderAll();
  } catch (e: any) {
    outEl.innerHTML = `<div class="muted">${e?.message ?? String(e)}</div>`;
  }
};


document.querySelector<HTMLButtonElement>("#reset")!.onclick = () => {
  lastEffects = [];
  renderAll();
};

document.querySelector<HTMLButtonElement>("#step")!.onclick = () => {
  try {
    const res = step(state, program);
    lastEffects = res.effects;
    renderAll();
  } catch (e: any) {
    outEl.textContent = e?.message ?? String(e);
  }
};

renderAll();
