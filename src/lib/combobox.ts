// Accessible searchable combobox over an existing <input> (AID-015). Vanilla, no
// deps. Used to chain País -> Estado -> Ciudad in the admin editor.
//
//   strict: true  -> the value must come from the options (País/Estado, VE city)
//   strict: false -> free text allowed, options are just suggestions (non-VE city)

export interface ComboOptions {
  input: HTMLInputElement;
  getOptions: () => string[];
  // Evaluated on each use so strictness can depend on a parent selection
  // (e.g. Venezuela city = strict, other-country city = free entry).
  strict: boolean | (() => boolean);
  onChange?: (value: string) => void;
}

export interface ComboHandle {
  refresh: () => void;
  setValue: (v: string, silent?: boolean) => void;
  getValue: () => string;
}

const fold = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export function createCombobox(opts: ComboOptions): ComboHandle {
  const { input, getOptions } = opts;
  const isStrict = () => (typeof opts.strict === "function" ? opts.strict() : opts.strict);

  const wrap = document.createElement("span");
  wrap.className = "combo";
  input.parentNode!.insertBefore(wrap, input);
  wrap.appendChild(input);
  input.setAttribute("autocomplete", "off");
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-expanded", "false");

  const menu = document.createElement("ul");
  menu.className = "combo-menu";
  menu.setAttribute("role", "listbox");
  menu.hidden = true;
  wrap.appendChild(menu);

  let active = -1; // highlighted index in the currently rendered menu
  let current: string[] = []; // options currently rendered

  function emit() {
    opts.onChange && opts.onChange(input.value);
  }

  function close() {
    menu.hidden = true;
    input.setAttribute("aria-expanded", "false");
    active = -1;
  }

  function render(filter: string) {
    const f = fold(filter);
    const all = getOptions();
    current = f ? all.filter((o) => fold(o).includes(f)) : all;
    menu.innerHTML = "";
    if (!current.length) { close(); return; }
    current.slice(0, 60).forEach((o, i) => {
      const li = document.createElement("li");
      li.className = "combo-opt";
      li.setAttribute("role", "option");
      li.textContent = o;
      li.addEventListener("mousedown", (e) => {
        e.preventDefault(); // keep focus, beat blur
        choose(o);
      });
      if (i === active) li.classList.add("active");
      menu.appendChild(li);
    });
    menu.hidden = false;
    input.setAttribute("aria-expanded", "true");
  }

  function choose(value: string) {
    input.value = value;
    close();
    emit();
  }

  function highlight(delta: number) {
    if (menu.hidden) { render(input.value); }
    const items = menu.querySelectorAll(".combo-opt");
    if (!items.length) return;
    active = (active + delta + items.length) % items.length;
    items.forEach((el, i) => el.classList.toggle("active", i === active));
    items[active].scrollIntoView({ block: "nearest" });
  }

  input.addEventListener("focus", () => render(input.value));
  input.addEventListener("input", () => { active = -1; render(input.value); if (!isStrict()) emit(); });
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); highlight(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); highlight(-1); }
    else if (e.key === "Enter") {
      if (!menu.hidden && active >= 0 && current[active]) { e.preventDefault(); choose(current[active]); }
      else if (!menu.hidden && current.length === 1) { e.preventDefault(); choose(current[0]); }
    } else if (e.key === "Escape") { close(); }
  });
  input.addEventListener("blur", () => {
    // Let a click on an option run first (it uses mousedown), then validate.
    setTimeout(() => {
      close();
      if (isStrict()) {
        const match = getOptions().find((o) => fold(o) === fold(input.value));
        const next = match || "";
        if (input.value !== next) { input.value = next; emit(); }
      } else {
        emit();
      }
    }, 120);
  });

  return {
    refresh() {
      // Parent changed: drop a now-invalid strict value, then auto-pick a lone option.
      if (isStrict() && input.value) {
        const match = getOptions().find((o) => fold(o) === fold(input.value));
        if (!match) input.value = "";
      }
      const all = getOptions();
      if (isStrict() && !input.value && all.length === 1) { input.value = all[0]; emit(); }
      if (!menu.hidden) render(input.value);
    },
    setValue(v, silent) {
      input.value = v || "";
      if (!silent) emit();
    },
    getValue() { return input.value; },
  };
}
