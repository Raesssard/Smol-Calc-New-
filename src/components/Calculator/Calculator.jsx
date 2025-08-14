// src/components/Calculator/Calculator.jsx
import React, { useEffect, useMemo, useReducer, useRef } from "react";
import "./Calculator.css";
import { initialState, reducer } from "./CalculatorLogic";
import HistoryList from "./HistoryList";

export default function Calculator() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const inputRef = useRef(null);

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

  const display = state.input === "" ? "0" : state.input;

  useEffect(() => {
    const onKey = (e) => {
      const k = e.key;
      if (/[\d+\-*/.]/.test(k)) dispatch({ type: "APPEND", value: k });
      else if (k === "Enter") { e.preventDefault(); dispatch({ type: "CALCULATE" }); }
      else if (k === "Backspace") dispatch({ type: "DELETE" });
      else if (k.toLowerCase() === "c") dispatch({ type: "CLEAR" });
      else if (k === "%") dispatch({ type: "PERCENT" });
      else if (k === "_") dispatch({ type: "TOGGLE_SIGN" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (state.lastAction === "CALCULATE" && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select?.();
    }
  }, [state.lastAction]);

  useEffect(() => {
    if (state.shake) {
      const t = setTimeout(() => dispatch({ type: "ERROR_SHAKE_DONE" }), 500);
      return () => clearTimeout(t);
    }
  }, [state.shake]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(display);
      dispatch({ type: "COPY_OK" });
    } catch {
      const ta = document.createElement("textarea");
      ta.value = display;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      dispatch({ type: "COPY_OK" });
    }
  };

  const onButtonClick = (b) => {
    if (b === "=") return dispatch({ type: "CALCULATE" });
    if (b === "C") return dispatch({ type: "CLEAR" });
    dispatch({ type: "APPEND", value: b });
  };

  return (
    <div className="calc-wrap">
      <div className={`calc-container ${state.shake ? "shake" : ""}`} aria-live="polite">
        <div className="calc-header">
          <h2 className="calc-title">Kalkulator React</h2>
          <div className="calc-actions">
            <button className="btn" onClick={() => dispatch({ type: "TOGGLE_HISTORY" })}>
              🕘 History
            </button>
            <button className="btn" onClick={handleCopy}>📋 Copy</button>
          </div>
        </div>

        <input ref={inputRef} type="text" value={display} readOnly className="calc-display" />

        <div className="calc-row">
          <button className="btn danger" onClick={() => dispatch({ type: "CLEAR" })}>C</button>
          <button className="btn" onClick={() => dispatch({ type: "DELETE" })}>⌫</button>
          <button className="btn" onClick={() => dispatch({ type: "PERCENT" })}>%</button>
          <button className="btn" onClick={() => dispatch({ type: "TOGGLE_SIGN" })}>±</button>
        </div>

        <div className="calc-buttons">
          {buttons.map((btn) => (
            <button
              key={btn.label}
              onClick={() => onButtonClick(btn.label)}
              className={`btn ${btn.label === "=" ? "equal" : ""}`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {state.showHistory && (
        <aside className="calc-history">
          <h3>Riwayat</h3>
          <HistoryList
            history={state.history}
            onSelect={(val) => {
              dispatch({ type: "CLEAR" });
              setTimeout(() => {
                for (const ch of val) dispatch({ type: "APPEND", value: ch });
              }, 0);
            }}
          />
        </aside>
      )}
    </div>
  );
}
