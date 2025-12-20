import "./style.css";
import { parseProgram } from "./sim/parser";
import { createState, step } from "./sim/cpu";

const src = `
addi x2, x2, -4
addi x5, x0, 42
sw   x5, 0(x2)
lw   x10, 0(x2)
`;

let state = createState();
const program = parseProgram(src);

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <pre id="code">${src}</pre>
  <button id="step">STEP</button>
  <pre id="out"></pre>
`;

const out = document.querySelector("#out")!;
document.querySelector("#step")!.onclick = () => {
  const res = step(state, program);
  out.textContent = JSON.stringify(res.effects, null, 2);
};
