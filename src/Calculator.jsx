import React, { useState, useEffect, useCallback } from "react";
import { evaluate } from "mathjs"; // library aman untuk hitung

export default function Calculator() {
  const [input, setInput] = useState("");

  const handleClick = (value) => {
    setInput((prev) => prev + value);
  };

  const handleClear = () => {
    setInput("");
  };

  const handleDelete = () => {
    setInput((prev) => prev.slice(0, -1));
  };

  const handleCalculate = useCallback(() => {
    try {
      const result = evaluate(input); // aman, tanpa eval
      setInput(result.toString());
    } catch {
      setInput("Error");
    }
  }, [input]);

  // Support keyboard input
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (/[\d+\-*/.]/.test(e.key)) {
        setInput((prev) => prev + e.key);
      } else if (e.key === "Enter") {
        handleCalculate();
      } else if (e.key === "Backspace") {
        handleDelete();
      } else if (e.key.toLowerCase() === "c") {
        handleClear();
      }
    };
    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [handleCalculate]); // sudah masuk dependencies

  const buttons = [
    "7", "8", "9", "/",
    "4", "5", "6", "*",
    "1", "2", "3", "-",
    "0", ".", "+", "="
  ];

  return (
    <div className="calc-container">
      <h2>Kalkulator React</h2>
      <input type="text" value={input} readOnly className="calc-display" />
      <div className="calc-buttons">
        {buttons.map((btn) => (
          <button
            key={btn}
            onClick={btn === "=" ? handleCalculate : () => handleClick(btn)}
            className={btn === "=" ? "equal" : ""}
          >
            {btn}
          </button>
        ))}
        <button onClick={handleDelete} className="delete">⌫</button>
        <button onClick={handleClear} className="clear">C</button>
      </div>
    </div>
  );
}
