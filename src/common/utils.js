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

export { truncate, sleep };
