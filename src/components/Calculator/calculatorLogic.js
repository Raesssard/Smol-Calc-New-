// src/components/Calculator/CalculatorLogic.js
import { evaluate } from "mathjs";

export const MAX_LEN = 18;

export const isLastCharOperator = (str) => /[+\-*/.]$/.test(str);

export const hasDotInLastNumber = (str) => {
  const parts = str.split(/[+\-*/]/);
  return parts[parts.length - 1]?.includes(".") ?? false;
};

export const getLastNumberRange = (str) => {
  if (!str) return null;
  let end = str.length;
  let start = end - 1;
  while (start >= 0) {
    if (/[+\-*/]/.test(str[start])) break;
    start--;
  }
  let numStart = start + 1;
  let number = str.slice(numStart, end);

  if (numStart > 0 && str[numStart - 1] === "-" && (numStart - 1 === 0 || /[+\-*/]/.test(str[numStart - 2]))) {
    numStart = numStart - 1;
    number = str.slice(numStart, end);
  }
  if (!number || /[+\-*/]$/.test(number)) return null;
  return { start: numStart, end, number };
};

export const clampDisplay = (s, max) => (s.length > max ? s.slice(0, max) : s);

export const initialState = {
  input: "0",
  error: false,
  shake: false,
  history: JSON.parse(localStorage.getItem("calcHistory") || "[]"),
  showHistory: JSON.parse(localStorage.getItem("showHistory") || "false"),
  lastAction: null,
};

export function reducer(state, action) {
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

      // Kurung
      if (value === "(") {
        const next = input + value;
        return next.length > MAX_LEN ? { ...state, shake: true, error: true, lastAction: "ERROR" }
          : { ...state, input: next, error: false, lastAction: "APPEND" };
      }
      if (value === ")") {
        if (!input.includes("(") || input.split("(").length <= input.split(")").length) return state;
        const next = input + value;
        return next.length > MAX_LEN ? { ...state, shake: true, error: true, lastAction: "ERROR" }
          : { ...state, input: next, error: false, lastAction: "APPEND" };
      }

      if (input === "0") {
        if (value === "0") return state;
        if (/\d/.test(value)) input = "";
      }

      const operators = ["+", "-", "*", "/"];
      const lastChar = input.slice(-1);

      if (operators.includes(value)) {
        if (input === "" && value !== "-") return state;
        if (operators.includes(lastChar)) {
          if (value === "-" && (lastChar === "*" || lastChar === "/")) {
            const next = input + value;
            return next.length > MAX_LEN ? { ...state, shake: true, error: true, lastAction: "ERROR" }
              : { ...state, input: next, error: false, lastAction: "APPEND" };
          }
          input = input.slice(0, -1) + value;
          return input.length > MAX_LEN ? { ...state, shake: true, error: true, lastAction: "ERROR" }
            : { ...state, input, error: false, lastAction: "REPLACE_OP" };
        }
      }

      if (value === "." && hasDotInLastNumber(input)) return state;

      const next = input + value;
      if (next.length > MAX_LEN) return { ...state, shake: true, error: true, lastAction: "ERROR" };
      return { ...state, input: next, error: false, lastAction: "APPEND" };
    }

    case "TOGGLE_SIGN": {
      const r = getLastNumberRange(state.input);
      if (!r) return state;
      const { start, end, number } = r;
      const toggled = number.startsWith("-") ? number.slice(1) : "-" + number;
      const next = state.input.slice(0, start) + toggled + state.input.slice(end);
      return next.length > MAX_LEN ? { ...state, shake: true, error: true, lastAction: "ERROR" }
        : { ...state, input: next, error: false, lastAction: "TOGGLE_SIGN" };
    }

    case "PERCENT": {
      const r = getLastNumberRange(state.input);
      if (!r) return state;
      const { start, end, number } = r;
      const n = Number(number);
      if (!isFinite(n)) return state;
      const asPercent = (n / 100).toString();
      const next = state.input.slice(0, start) + asPercent + state.input.slice(end);
      return next.length > MAX_LEN ? { ...state, shake: true, error: true, lastAction: "ERROR" }
        : { ...state, input: next, error: false, lastAction: "PERCENT" };
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
        localStorage.setItem("calcHistory", JSON.stringify(updatedHistory));
        return { ...state, input: clipped, error: false, shake: false, history: updatedHistory, lastAction: "CALCULATE" };
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
      localStorage.setItem("showHistory", JSON.stringify(newShowHistory));
      return { ...state, showHistory: newShowHistory };
    }

    default:
      return state;
  }
}
