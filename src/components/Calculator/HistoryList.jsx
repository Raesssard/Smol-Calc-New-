// src/components/Calculator/HistoryList.jsx
import React from "react";
import { clampDisplay, MAX_LEN } from "./CalculatorLogic";

export default function HistoryList({ history, onSelect }) {
  if (history.length === 0) {
    return <p className="muted">Belum ada riwayat.</p>;
  }
  return (
    <ul>
      {history.map((h, i) => (
        <li key={i}>
          <button
            className="hist-item"
            onClick={() => onSelect(clampDisplay(String(h.result), MAX_LEN))}
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
  );
}
