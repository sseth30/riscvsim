import type { Effect } from "./types";

export const abiNames = [
  "zero","ra","sp","gp","tp","t0","t1","t2","s0/fp","s1",
  "a0","a1","a2","a3","a4","a5","a6","a7",
  "s2","s3","s4","s5","s6","s7","s8","s9","s10","s11",
  "t3","t4","t5","t6"
];

export function hex32(n: number) {
  return "0x" + (n >>> 0).toString(16).padStart(8, "0");
}

export function bin32(n: number) {
  return (n >>> 0).toString(2).padStart(32, "0");
}

function leWord(bytes: number[]) {
  const v =
    (bytes[0] | 0) |
    ((bytes[1] | 0) << 8) |
    ((bytes[2] | 0) << 16) |
    ((bytes[3] | 0) << 24);
  return v | 0;
}

function regLabel(i: number) {
  return `x${i} (${abiNames[i]})`;
}

export function formatEffects(effects: Effect[]) {
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
      const beforeWord = leWord(e.beforeBytes);
      const afterWord = leWord(e.afterBytes);
      const beforeBytes = e.beforeBytes.map((b) => b.toString(16).padStart(2, "0")).join(" ");
      const afterBytes = e.afterBytes.map((b) => b.toString(16).padStart(2, "0")).join(" ");
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

export function changedRegsFromEffects(effects: Effect[]) {
  const set = new Set<number>();
  for (const e of effects) if (e.kind === "reg") set.add(e.reg);
  return set;
}

export function renderRegsTable(changed: Set<number>, regs: Int32Array) {
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
