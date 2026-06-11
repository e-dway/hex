// Form-field constructors for the entity editors. Each one binds to a shared
// `draft` object and refreshes the linked raw-JSON view so the textarea stays
// the single source of truth at save time.

import { el } from "./util.js";

export function makeForm(draft, onDraftChange) {
  let rawArea = null;

  const refreshRaw = () => {
    if (rawArea && document.activeElement !== rawArea) {
      rawArea.value = JSON.stringify(draft, null, 2);
    }
  };

  const setVal = (key, val) => {
    if (val === "" || val === undefined) delete draft[key];
    else draft[key] = val;
    refreshRaw();
    onDraftChange?.(key, val);
  };

  const get = (key, fallback = "") => (draft[key] ?? fallback);

  const api = {
    text(key, label, opts = {}) {
      const input = el("input", {
        type: opts.type || "text",
        value: get(key),
        placeholder: opts.placeholder || "",
        oninput: (e) => setVal(key, e.target.value),
      });
      api._inputs[key] = input;
      return field(label, input, opts.hint);
    },

    number(key, label, opts = {}) {
      const input = el("input", {
        type: "number",
        value: draft[key] ?? "",
        step: opts.step ?? "any",
        min: opts.min,
        max: opts.max,
        oninput: (e) => setVal(key, e.target.value === "" ? "" : Number(e.target.value)),
      });
      api._inputs[key] = input;
      return field(label, input, opts.hint);
    },

    textarea(key, label, opts = {}) {
      const input = el("textarea", {
        class: opts.code ? "code" : "",
        rows: opts.rows || 4,
        placeholder: opts.placeholder || "",
        oninput: (e) => setVal(key, e.target.value),
      });
      input.value = get(key);
      api._inputs[key] = input;
      return field(label, input, opts.hint);
    },

    select(key, label, options, opts = {}) {
      const sel = el(
        "select",
        { onchange: (e) => setVal(key, e.target.value) },
        options.map((o) => {
          const value = typeof o === "string" ? o : o.value;
          const text = typeof o === "string" ? o : o.label;
          return el("option", { value, selected: String(get(key, opts.default)) === String(value) }, text);
        })
      );
      api._inputs[key] = sel;
      return field(label, sel, opts.hint);
    },

    check(key, label, opts = {}) {
      const input = el("input", {
        type: "checkbox",
        checked: !!draft[key],
        onchange: (e) => setVal(key, e.target.checked),
      });
      api._inputs[key] = input;
      return el("label", { class: "check" }, [input, el("span", { text: label })]);
    },

    // Multi-select tag picker. Stores an array under `key`.
    tags(key, label, allTags, opts = {}) {
      const selected = new Set((draft[key] || []).map(String));
      const valueOf = opts.byId ? (t) => t.id : (t) => t.name;
      const box = el(
        "div",
        { class: "tagpick" },
        allTags.map((t) => {
          const v = valueOf(t);
          const cb = el("input", {
            type: "checkbox",
            checked: selected.has(String(v)),
            onchange: (e) => {
              if (e.target.checked) selected.add(String(v));
              else selected.delete(String(v));
              const arr = allTags.filter((x) => selected.has(String(valueOf(x)))).map(valueOf);
              setVal(key, arr);
            },
          });
          return el("label", { title: t.family || "" }, [cb, t.name]);
        })
      );
      return field(label, box, opts.hint || `${allTags.length} tags available`);
    },

    rawJson() {
      rawArea = el("textarea", {
        class: "code",
        rows: 12,
        spellcheck: "false",
        oninput: () => {
          try {
            const parsed = JSON.parse(rawArea.value);
            // Replace contents in place so other refs keep pointing at `draft`.
            for (const k of Object.keys(draft)) delete draft[k];
            Object.assign(draft, parsed);
            rawArea.setCustomValidity("");
          } catch {
            rawArea.setCustomValidity("Invalid JSON");
          }
        },
      });
      rawArea.value = JSON.stringify(draft, null, 2);
      return el("details", { class: "adv" }, [
        el("summary", { text: "Advanced · raw JSON payload" }),
        el("div", { class: "field", style: "margin-top:12px" }, [
          el("div", { class: "field-hint", text: "Sent verbatim on save — for any field the form above doesn't surface." }),
          rawArea,
        ]),
      ]);
    },

    setField(key, value) {
      setVal(key, value);
      const input = api._inputs[key];
      if (input) {
        if (input.type === "checkbox") input.checked = !!value;
        else input.value = value ?? "";
      }
    },

    _inputs: {},
    refreshRaw,
  };

  return api;
}

function field(label, control, hint) {
  return el("div", { class: "field" }, [
    el("label", { text: label }),
    control,
    hint ? el("div", { class: "field-hint", text: hint }) : null,
  ]);
}

export function row(...fields) {
  return el("div", { class: "field--row" }, fields);
}
