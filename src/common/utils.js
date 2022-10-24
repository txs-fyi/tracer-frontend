import { ethers } from "ethers";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function truncate(str, maxDecimalDigits) {
  if (str.includes(".")) {
    const parts = str.split(".");
    return parts[0] + "." + parts[1].slice(0, maxDecimalDigits);
  }
  return str;
}

function shortAddress(addr) {
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

const stringify = function (obj) {
  if (obj === null) return "null";
  if (Array.isArray(obj)) {
    return "[" + obj.map((x) => stringify(x)) + "]";
  }
  if (ethers.BigNumber.isBigNumber(obj)) {
    return obj.toString();
  }

  const type = typeof obj;
  if (type === "string") return "'" + obj + "'";
  if (type === "boolean" || type === "number") return obj;
  if (type === "function") return obj.toString();
  const ret = [];
  for (const prop in obj) {
    ret.push(prop + ": " + stringify(obj[prop]));
  }
  return "{" + ret.join(",") + "}";
};

export { truncate, sleep, shortAddress, stringify };
