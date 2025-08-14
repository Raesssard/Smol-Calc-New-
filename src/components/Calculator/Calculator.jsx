import React, { useEffect, useMemo, useReducer, useRef } from "react";
import "./Calculator.css";
import { evaluate } from "mathjs";

/* =========================
   Helpers (di luar komponen)
   ========================= */
const isLastCharOperator = (str) => /[+\-*/.]$/.test(str);

const hasDotInLastNumber = (str) => {
  const parts = str.split(/[+\-*/]/);
  return parts[parts.length - 1]?.includes(".") ?? false;
};

// Ambil rentang index angka terakhir (untuk ± dan %)
const getLastNumberRange = (str) => {
  if (!str) return null;
  // Temukan index mulai dari belakang hingga ketemu operator (+ - * /)
  let end = str.length; // eksklusif
  let start = end - 1;
  while (start >= 0) {
    const ch = str[start];
    if (/[+\-*/]/.test(ch)) {
      // Handle tanda minus sebagai sign, bukan operator, jika tepat di depan angka
      // contoh "12*-3" -> angka terakhir "-3" dimulai dari tanda '-' setelah '*'
      // start berhenti di operator: angka mulai sesudah operator kecuali jika ada minus sign
      break;
    }
    start--;
  }
  // angka mulai setelah operator yang ditemukan
  let numStart = start + 1;
  let number = str.slice(numStart, end);

  // Jika ada minus sign yang melekat dengan angka (misal di awal string atau setelah operator)
  if (numStart > 0 && str[numStart - 1] === "-" && (numStart - 1 === 0 || /[+\-*/]/.test(str[numStart - 2]))) {
    numStart = numStart - 1;
    number = str.slice(numStart, end);
  }
  if (!number || /[+\-*/]$/.test(number)) return null;
  return { start: numStart, end, number };
};

const clampDisplay = (s, max) => (s.length > max ? s.slice(0, max) : s);

const MAX_LEN = 18;

/* =============
   Reducer & State
   ============= */
const initialState = {
  input: "0",
  error: false,
  shake: false,
  history: JSON.parse(localStorage.getItem("calcHistory") || "[]"),
  showHistory: JSON.parse(localStorage.getItem("showHistory") || "false"), // 🔹 load status
  lastAction: null,
};



function reducer(state, action) {
  switch (action.type) {
    case "CLEAR":
      return { ...state, input: "", error: false, shake: false, lastAction: "CLEAR" };

    case "DELETE": {
      if (state.error) return { ...state, input: "", error: false, shake: false, lastAction: "DELETE" };
      const next = state.input.slice(0, -1);
      return { ...state, input: next, lastAction: "DELETE" };
    }

case "APPEND": {
  let { value } = action;
  let input = state.input;

  if (state.error) {
    if (/[+\-*/.]/.test(value)) input = "0";
    else input = "";
  }

  // Kurung buka/tutup
  if (value === "(") {
    const next = input + value;
    return next.length > MAX_LEN
      ? { ...state, shake: true, error: true, lastAction: "ERROR" }
      : { ...state, input: next, error: false, lastAction: "APPEND" };
  }
  if (value === ")") {
    // Jangan izinkan ")" di awal atau tanpa "(" sebelumnya
    if (!input.includes("(") || input.split("(").length <= input.split(")").length) {
      return state;
    }
    const next = input + value;
    return next.length > MAX_LEN
      ? { ...state, shake: true, error: true, lastAction: "ERROR" }
      : { ...state, input: next, error: false, lastAction: "APPEND" };
  }

  // Cegah "0" berulang di depan
  if (input === "0") {
    if (value === "0") return state;
    if (/\d/.test(value)) input = "";
  }

  const operators = ["+", "-", "*", "/"];
  const lastChar = input.slice(-1);

  // Kalau operator
  if (operators.includes(value)) {
    if (input === "" && value !== "-") return state; // hanya "-" boleh di awal
    if (operators.includes(lastChar)) {
      // Izinkan *- atau /-
      if (value === "-" && (lastChar === "*" || lastChar === "/")) {
        const next = input + value;
        return next.length > MAX_LEN
          ? { ...state, shake: true, error: true, lastAction: "ERROR" }
          : { ...state, input: next, error: false, lastAction: "APPEND" };
      }
      // Selain itu, replace operator sebelumnya
      input = input.slice(0, -1) + value;
      return input.length > MAX_LEN
        ? { ...state, shake: true, error: true, lastAction: "ERROR" }
        : { ...state, input, error: false, lastAction: "REPLACE_OP" };
    }
  }

  // Cegah titik ganda di angka terakhir
  if (value === "." && hasDotInLastNumber(input)) return state;

  const next = input + value;
  if (next.length > MAX_LEN) return { ...state, shake: true, error: true, lastAction: "ERROR" };
  return { ...state, input: next, error: false, lastAction: "APPEND" };
}

    case "TOGGLE_SIGN": {
      const r = getLastNumberRange(state.input);
      if (!r) return state;
      const { start, end, number } = r;
      let toggled;
      if (number.startsWith("-")) {
        toggled = number.slice(1);
      } else {
        toggled = "-" + number;
      }
      const next = state.input.slice(0, start) + toggled + state.input.slice(end);
      if (next.length > MAX_LEN) return { ...state, shake: true, error: true, lastAction: "ERROR" };
      return { ...state, input: next, error: false, lastAction: "TOGGLE_SIGN" };
    }

    case "PERCENT": {
      const r = getLastNumberRange(state.input);
      if (!r) return state;
      const { start, end, number } = r;
      const n = Number(number);
      if (!isFinite(n)) return state;
      const asPercent = (n / 100).toString();
      const next = state.input.slice(0, start) + asPercent + state.input.slice(end);
      if (next.length > MAX_LEN) return { ...state, shake: true, error: true, lastAction: "ERROR" };
      return { ...state, input: next, error: false, lastAction: "PERCENT" };
    }

case "CALCULATE": {
  const expr = state.input;
  if (!expr || isLastCharOperator(expr)) {
    return { ...state, input: "Error", error: true, shake: true, lastAction: "ERROR" };
  }
  try {
    const raw = evaluate(expr);
    const result = String(raw);
    const clipped = clampDisplay(result, MAX_LEN);
    const historyItem = { expr, result: result, time: Date.now() };

    const updatedHistory = [historyItem, ...state.history].slice(0, 20);
    localStorage.setItem("calcHistory", JSON.stringify(updatedHistory)); // 🔹 simpan ke localStorage

    return {
      ...state,
      input: clipped,
      error: false,
      shake: false,
      history: updatedHistory,
      lastAction: "CALCULATE",
    };
  } catch {
    return { ...state, input: "Error", error: true, shake: true, lastAction: "ERROR" };
  }
}


    case "COPY_OK":
      return { ...state, lastAction: "COPY_OK" };

    case "ERROR_SHAKE_DONE":
      return { ...state, shake: false };

case "TOGGLE_HISTORY": {
  const newShowHistory = !state.showHistory;
  localStorage.setItem("showHistory", JSON.stringify(newShowHistory)); // 🔹 save status
  return { ...state, showHistory: newShowHistory };
}

    default:
      return state;
  }
}

/* =============
   Komponen
   ============= */
export default function Calculator() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const inputRef = useRef(null);

  // Tombol (useMemo supaya tidak re-render)
const buttons = useMemo(
  () => [
    { label: "(" }, { label: ")" }, { label: "C" }, { label: "/" },
    { label: "7" }, { label: "8" }, { label: "9" }, { label: "*" },
    { label: "4" }, { label: "5" }, { label: "6" }, { label: "-" },
    { label: "1" }, { label: "2" }, { label: "3" }, { label: "+" },
    { label: "0" }, { label: "." }, { label: "=" }
  ],
  []
);


  // Display
  const display = state.input === "" ? "0" : state.input;

  // Keyboard support
  useEffect(() => {
    const onKey = (e) => {
      const k = e.key;
      if (/[\d+\-*/.]/.test(k)) {
        dispatch({ type: "APPEND", value: k });
      } else if (k === "Enter") {
        e.preventDefault();
        dispatch({ type: "CALCULATE" });
      } else if (k === "Backspace") {
        dispatch({ type: "DELETE" });
      } else if (k.toLowerCase() === "c") {
        dispatch({ type: "CLEAR" });
      } else if (k === "%") {
        dispatch({ type: "PERCENT" });
      } else if (k === "_") {
        // alternatif keyboard untuk ± (shift + - biasanya = _)
        dispatch({ type: "TOGGLE_SIGN" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Auto-focus ke display setelah CALCULATE
  useEffect(() => {
    if (state.lastAction === "CALCULATE" && inputRef.current) {
      inputRef.current.focus();
      // select agar user bisa ketik langsung ganti
      inputRef.current.select?.();
    }
  }, [state.lastAction]);

  // Matikan shake setelah animasi
  useEffect(() => {
    if (state.shake) {
      const t = setTimeout(() => dispatch({ type: "ERROR_SHAKE_DONE" }), 500);
      return () => clearTimeout(t);
    }
  }, [state.shake]);

  // Copy to clipboard
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(display);
      dispatch({ type: "COPY_OK" });
    } catch {
      // fallback
      const ta = document.createElement("textarea");
      ta.value = display;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      dispatch({ type: "COPY_OK" });
    }
  };

  // Handler klik tombol
  const onButtonClick = (b) => {
    if (b === "=") return dispatch({ type: "CALCULATE" });
    dispatch({ type: "APPEND", value: b });
  };

  return (
    <div className="calc-wrap">
      <div className={`calc-container ${state.shake ? "shake" : ""}`} aria-live="polite">
        <div className="calc-header">
          <h2 className="calc-title">Kalkulator React</h2>
          <div className="calc-actions">
            <button
              className="btn"
              onClick={() => dispatch({ type: "TOGGLE_HISTORY" })}
              aria-label={state.showHistory ? "Sembunyikan riwayat" : "Tampilkan riwayat"}
              title={state.showHistory ? "Sembunyikan riwayat" : "Tampilkan riwayat"}
            >
              🕘 History
            </button>
            <button
              className="btn"
              onClick={handleCopy}
              aria-label="Salin hasil ke clipboard"
              title="Copy"
            >
              📋 Copy
            </button>
          </div>
        </div>

        <input
          ref={inputRef}
          type="text"
          value={display}
          readOnly
          className="calc-display"
          aria-label={`Tampilan kalkulator: ${display}`}
        />

        <div className="calc-row">
          <button className="btn danger" onClick={() => dispatch({ type: "CLEAR" })} aria-label="Clear">C</button>
          <button className="btn" onClick={() => dispatch({ type: "DELETE" })} aria-label="Hapus satu karakter">⌫</button>
          <button className="btn" onClick={() => dispatch({ type: "PERCENT" })} aria-label="Persen">%</button>
          <button className="btn" onClick={() => dispatch({ type: "TOGGLE_SIGN" })} aria-label="Ubah positif negatif">±</button>
        </div>

        <div className="calc-buttons" role="grid" aria-label="Tombol angka dan operator">
          {buttons.map((btn) => (
            <button
              key={btn.label}
              role="gridcell"
              onClick={() => onButtonClick(btn.label)}
              className={`btn ${btn.label === "=" ? "equal" : ""}`}
              aria-label={`Tombol ${btn.label}`}
              title={btn.label}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {state.showHistory && (
        <aside className="calc-history" aria-label="Riwayat perhitungan">
          <h3>Riwayat</h3>
          {state.history.length === 0 ? (
            <p className="muted">Belum ada riwayat.</p>
          ) : (
            <ul>
              {state.history.map((h, i) => (
                <li key={i}>
                  <button
                    className="hist-item"
                    onClick={() => {
                      // klik riwayat akan memindahkan hasil ke display
                      // (bisa juga masukkan kembali expr bila mau)
                      // Di sini memakai result agar cepat hitung lanjut
                      // dan tidak melebihi MAX_LEN.
                      const next = clampDisplay(String(h.result), MAX_LEN);
                      // gunakan dua aksi agar bersih dari error
                      dispatch({ type: "CLEAR" });
                      // sedikit delay agar CLEAR diterapkan dulu
                      setTimeout(() => {
                        for (const ch of next) dispatch({ type: "APPEND", value: ch });
                      }, 0);
                    }}
                    aria-label={`Gunakan hasil ${h.result} dari ekspresi ${h.expr}`}
                    title={`${h.expr} = ${h.result}`}
                  >
                    <span className="expr">{h.expr}</span>
                    <span className="eq">=</span>
                    <span className="res">{h.result}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
      )}
    </div>
  );
}
