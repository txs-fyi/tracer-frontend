import { ethers } from "ethers";
import { useEffect, useState, useCallback } from "react";
import { GenericPage } from "./Page";
import { useParams } from "react-router-dom";
import { ABIS } from "../common/abis";

import "./treeList.css";
import { Tooltip } from "@geist-ui/react";

// Default decoder with common abis
const defaultDecoder = new ethers.utils.Interface(ABIS);

// Extract out all function signatures (4bytes)
function getUnknownFunctionSignatures(decoder, stackTrace) {
  const { input, calls } = stackTrace;
  const innerCalls = calls || [];

  try {
    // Decoder successfully decoded the data,
    // its a known function signature
    decoder.parseTransaction({ data: input });
    return [
      ...innerCalls.map((x) => getUnknownFunctionSignatures(decoder, x)).flat(),
    ];
  } catch (e) {
    // Decoder doesn't know the function signature, add it
    return [
      input.slice(0, 10),
      ...innerCalls.map((x) => getUnknownFunctionSignatures(decoder, x)).flat(),
    ];
  }
}

// Only gets unique function signatures
function getUniqueUnkownFunctionSignatures(decoder, stackTrace) {
  return Array.from(
    new Set(getUnknownFunctionSignatures(decoder, stackTrace))
  ).flat();
}

// Extract out all the addresses from the decoder
function getUnkownAddresses(knownAddresses, stackTrace) {
  // Convert to lowercase
  const { from, to, calls } = stackTrace;

  let unknowns = [];

  // If not found
  if (!knownAddresses[from.toLowerCase()]) {
    unknowns.push(from.toLowerCase());
  }

  if (!knownAddresses[to.toLowerCase()]) {
    unknowns.push(to.toLowerCase());
  }

  return [
    ...unknowns,
    ...(calls || []).map((x) => getUnkownAddresses(knownAddresses, x)).flat(),
  ];
}

function getUniqueUnknownAddresses(knownAddresses, stackTrace) {
  return Array.from(
    new Set(getUnkownAddresses(knownAddresses, stackTrace))
  ).flat();
}

function TraceViewer(stackTrace) {
  const {
    type,
    to,
    gas,
    prettyValue,
    prettyAddress,
    prettyInput,
    prettyOutput,
    input,
    output,
    calls,
    error,
  } = stackTrace;

  const prettyValueStr =
    (prettyValue || null) === null
      ? ""
      : `ETH: ${ethers.utils.formatEther(prettyValue)}`;

  const prettyGas = parseInt(gas, 16);

  return (
    <li key={`${isNaN(prettyGas) ? "0" : prettyGas.toString()}`}>
      <details open>
        <summary>
          [{type}]{prettyValueStr}
          {prettyAddress || to}::{prettyInput || input}
        </summary>
        <ul>
          {(calls || []).length > 0 && calls.map((x) => TraceViewer(x))}
          {output !== undefined && (
            <li key={`return-${parseInt(gas, 16).toString()}`}>
              return [{prettyOutput || output}]
            </li>
          )}
          {
            // Sending ETH doesn't return value it seems
            output === undefined && error === undefined && (
              <li key={`return-${parseInt(gas, 16).toString()}`}>
                return [0x]
              </li>
            )
          }
          {error !== undefined && (
            <li
              className="error-li"
              key={`revert-${parseInt(gas, 16).toString()}`}
            >
              reverted [{error}]
            </li>
          )}
        </ul>
      </details>
    </li>
  );
}

// Make the contract traces readable
function formatTraceTree(decoder, knownContractAddresses, stackTrace) {
  let prettyInput = null;
  let prettyAddress = null;
  let prettyOutput = null;
  let prettyValue = null;

  try {
    const txDescription = decoder.parseTransaction({ data: stackTrace.input });
    const txParams = txDescription.functionFragment.inputs
      .map((x) => x.name)
      .filter((x) => x !== null);

    // Sometimes it has the tx param name
    if (txParams.length > 0) {
      const txArgs = txParams
        .map((x) => txDescription.args[x])
        .map((x) => x.toString());
      prettyInput =
        txDescription.name +
        "(" +
        txArgs.map((x, idx) => txParams[idx] + "=" + txArgs[idx] + ")");
    } else {
      // Otherwise no params
      prettyInput =
        txDescription.name +
        "(" +
        txDescription.args.map((x) => x.toString()) +
        ")";
    }
  } catch (e) {}

  try {
    // If theres an address inside
    if (!!knownContractAddresses[stackTrace.to.toLowerCase()]) {
      prettyAddress = knownContractAddresses[stackTrace.to.toLowerCase()];
    }
  } catch (e) {}

  if (stackTrace.value) {
    try {
      const bn = ethers.BigNumber.from(stackTrace.value);
      if (bn.gt(ethers.constants.Zero)) {
        prettyValue = bn;
      }
    } catch (e) {}
  }

  return {
    ...stackTrace,
    prettyValue,
    prettyAddress,
    prettyInput,
    prettyOutput,
    calls: (stackTrace.calls || []).map((x) =>
      formatTraceTree(decoder, knownContractAddresses, x)
    ),
  };
}

export const TracePage = () => {
  const { txhash } = useParams();

  const [invalidTxHash, setInvalidTxHash] = useState(false);
  const [callTrace, setCallTrace] = useState(null);

  const getTraces = useCallback(async () => {
    const traceData = await fetch(
      `http://localhost:3001/eth/${txhash}?callTrace=true`,
      {
        method: "GET",
      }
    )
      .then((x) => x.json())
      .catch(() => null);

    if (traceData === null || traceData.callTrace === undefined) {
      setInvalidTxHash(true);
      return;
    }

    console.log(traceData.callTrace);
    setCallTrace(traceData.callTrace);
  }, [txhash]);

  useEffect(() => {
    if (!invalidTxHash && callTrace === null) {
      getTraces();
    }
    if (!invalidTxHash && callTrace) {
    }
  }, [getTraces, invalidTxHash, callTrace]);

  return (
    <GenericPage>
      {callTrace !== null && (
        <ul className="tree">
          <li key="root">
            <details open>
              <summary>[Sender] {callTrace.from}</summary>
              <ul>{TraceViewer(callTrace)}</ul>
            </details>
          </li>
        </ul>
      )}
    </GenericPage>
  );
};
