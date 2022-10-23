import { ethers } from "ethers";
import { useEffect, useState, useCallback } from "react";
import { GenericPage } from "./Page";
import { useParams } from "react-router-dom";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { ABIS } from "../common/abis";

import "./treeList.css";
import { Text } from "@geist-ui/react";
import { sleep, truncate } from "../common/utils";

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
      : `[ETH:${truncate(ethers.utils.formatEther(prettyValue), 6)}]`;

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

  const [ifaceDecoder, setIFaceDecoder] = useState(null);
  const [knownContractAddresses, setKnownContractAddresses] = useLocalStorage(
    "contractAddresses",
    {}
  );
  const [knownSignatures, setKnownSignatures] = useLocalStorage(
    "signatures",
    []
  );
  const [invalidTxHash, setInvalidTxHash] = useState(false);
  const [callTrace, setCallTrace] = useState(null);
  const [hasUpdatedLocalStorage, setHasUpdatedLocalStorage] = useState(false);

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

    setCallTrace(traceData.callTrace);
  }, [txhash]);

  const getAddressAndSignaturesAndUpdateCallTrace = useCallback(async () => {
    // Debounce
    if (hasUpdatedLocalStorage) return;
    setHasUpdatedLocalStorage(true);

    // Get function signatures
    const unknown4s = getUniqueUnkownFunctionSignatures(
      ifaceDecoder,
      callTrace
    );
    const hexSigsRes = await Promise.all(
      unknown4s.map((x) =>
        fetch(
          `https://www.4byte.directory/api/v1/signatures/?format=json&hex_signature=${x}`,
          {
            method: "GET",
          }
        )
          .then((x) => x.json())
          .catch(() => null)
      )
    );
    const hexSigsResFlattened = hexSigsRes
      .filter((x) => x !== null)
      .map((x) => x.results)
      .flat();
    const newSignatures = hexSigsResFlattened.map(
      (x) => "function " + x.text_signature
    );

    // Save to localStorage
    const newKnownSignatures = [...knownSignatures, ...newSignatures];

    // Set a new decoder
    const newIFaceDecoder = new ethers.utils.Interface([
      ...ifaceDecoder.format(),
      ...newKnownSignatures,
    ]);

    // Attempt to get contract address name, rate limited to 5 every 1 second
    const unknownAddresses = getUniqueUnknownAddresses(
      knownContractAddresses,
      callTrace
    );
    let addressesSourceCode = [];
    for (let i = 0; i < unknownAddresses.length; i += 5) {
      const curSourceCodes = await Promise.all(
        unknownAddresses.slice(i, i + 5).map((x) =>
          fetch(
            `https://api.etherscan.io/api?module=contract&action=getsourcecode&address=${x}&apikey=CAXVKF8PKZ3GV79PYYNPTUQ2J1TVKRPP51`,
            {
              method: "GET",
            }
          )
            .then((x) => x.json())
            .catch(() => {
              return { error: true };
            })
        )
      );
      addressesSourceCode = [...addressesSourceCode, ...curSourceCodes];

      // Rate limit of 5 req per second
      if (unknownAddresses.length >= 5) {
        await sleep(1010);
      }

      // Exrtract out source code name (very hacky yes)
      const addressesNames = addressesSourceCode.map((x) => {
        let name = null;
        try {
          name = x.result[0]["ContractName"];
        } catch (e) {}
        if (name === "") {
          name = null;
        }
        return name;
      });

      // New key value
      const addressesWithNames = unknownAddresses
        .map((_, idx) => {
          return [unknownAddresses[idx].toLowerCase(), addressesNames[idx]];
        })
        .reduce((acc, x) => {
          if (x[1] === null) return acc;
          return {
            ...acc,
            [x[0]]: x[1],
          };
        }, {});

      // Save new Addresses
      const newKnownContractAddresses = {
        ...knownContractAddresses,
        ...addressesWithNames,
      };

      // Re-format trace data with new data
      const newStackTrace = formatTraceTree(
        newIFaceDecoder,
        newKnownContractAddresses,
        callTrace
      );

      // Finally set all the call data after we've parsed all the
      setCallTrace(newStackTrace);
      setIFaceDecoder(newIFaceDecoder);
      setKnownContractAddresses(newKnownContractAddresses);
      setKnownSignatures(newKnownSignatures);
    }
  }, [
    hasUpdatedLocalStorage,
    setKnownContractAddresses,
    setKnownSignatures,
    ifaceDecoder,
    knownContractAddresses,
    knownSignatures,
    callTrace,
  ]);

  useEffect(() => {
    // Initialize decoder
    if (ifaceDecoder === null) {
      setIFaceDecoder(
        new ethers.utils.Interface([
          ...defaultDecoder.format(),
          ...knownSignatures,
        ])
      );
    }

    // Get traces
    if (!invalidTxHash && callTrace === null) {
      getTraces();
    }
    if (!invalidTxHash && callTrace) {
    }
  }, [getTraces, ifaceDecoder, knownSignatures, invalidTxHash, callTrace]);

  useEffect(() => {
    if (invalidTxHash) return;
    if (callTrace === null) return;

    // Get 4byte signatures
    if (!hasUpdatedLocalStorage) {
      getAddressAndSignaturesAndUpdateCallTrace();
    }
  }, [
    getAddressAndSignaturesAndUpdateCallTrace,
    hasUpdatedLocalStorage,
    invalidTxHash,
    callTrace,
  ]);

  return (
    <GenericPage>
      {callTrace === null && invalidTxHash && <Text h2>Invalid txhash</Text>}
      {callTrace !== null && (
        <ul className="tree">
          <li key="root">
            <details open>
              <summary>[Sender]{callTrace.from}</summary>
              <ul>{TraceViewer(callTrace)}</ul>
            </details>
          </li>
        </ul>
      )}
    </GenericPage>
  );
};
