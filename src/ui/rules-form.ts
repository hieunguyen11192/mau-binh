import {
  DEFAULT_TABLE_RULES,
  normalizeRules,
  type TableRules,
} from '../core/table-rules'

/** Build a compact yes/no + amount form for So Át / Át to / Heo. */
export function createRulesForm(
  initial: Partial<TableRules> = DEFAULT_TABLE_RULES,
): { root: HTMLElement; getRules: () => TableRules; setEnabled: (on: boolean) => void } {
  const rules = normalizeRules(initial)
  const root = document.createElement('div')
  root.className = 'rules-form'
  root.innerHTML = `
    <div class="rules-title">Luật bàn</div>
    <label class="rules-row">
      <span>Đọ Át</span>
      <select data-soat-on>
        <option value="1">Yes</option>
        <option value="0">No</option>
      </select>
      <input type="number" data-soat-ante min="0" step="1" title="Tiền mỗi nhà" />
    </label>
    <label class="rules-row">
      <span>Át to ăn tất</span>
      <select data-atlon-on>
        <option value="1">Yes</option>
        <option value="0">No</option>
      </select>
      <input type="number" data-atlon-ante min="0" step="1" title="Tiền mỗi nhà" />
    </label>
    <label class="rules-row">
      <span>Bỏ heo</span>
      <select data-heo-on>
        <option value="1">Yes</option>
        <option value="0">No</option>
      </select>
      <input type="number" data-heo-ante min="0" step="1" title="Tiền mỗi nhà / ván" />
    </label>
    <p class="rules-hint">Heo: mỗi ván bỏ vào rổ; ai sập cả bàn (3 chi vs mọi đối thủ) hốt hết.</p>
  `

  const soAtOn = root.querySelector<HTMLSelectElement>('[data-soat-on]')!
  const soAtAnte = root.querySelector<HTMLInputElement>('[data-soat-ante]')!
  const atLonOn = root.querySelector<HTMLSelectElement>('[data-atlon-on]')!
  const atLonAnte = root.querySelector<HTMLInputElement>('[data-atlon-ante]')!
  const heoOn = root.querySelector<HTMLSelectElement>('[data-heo-on]')!
  const heoAnte = root.querySelector<HTMLInputElement>('[data-heo-ante]')!

  soAtOn.value = rules.soAtEnabled ? '1' : '0'
  soAtAnte.value = String(rules.soAtAnte)
  atLonOn.value = rules.atLonEnabled ? '1' : '0'
  atLonAnte.value = String(rules.atLonAnte)
  heoOn.value = rules.heoEnabled ? '1' : '0'
  heoAnte.value = String(rules.heoAnte)

  function syncDisabled(): void {
    soAtAnte.disabled = soAtOn.value !== '1'
    atLonAnte.disabled = atLonOn.value !== '1'
    heoAnte.disabled = heoOn.value !== '1'
  }
  soAtOn.addEventListener('change', syncDisabled)
  atLonOn.addEventListener('change', syncDisabled)
  heoOn.addEventListener('change', syncDisabled)
  syncDisabled()

  function getRules(): TableRules {
    return normalizeRules({
      soAtEnabled: soAtOn.value === '1',
      soAtAnte: Number(soAtAnte.value),
      atLonEnabled: atLonOn.value === '1',
      atLonAnte: Number(atLonAnte.value),
      heoEnabled: heoOn.value === '1',
      heoAnte: Number(heoAnte.value),
    })
  }

  function setEnabled(on: boolean): void {
    root.querySelectorAll('select, input').forEach((el) => {
      ;(el as HTMLInputElement).disabled = !on
    })
    if (on) syncDisabled()
  }

  return { root, getRules, setEnabled }
}
