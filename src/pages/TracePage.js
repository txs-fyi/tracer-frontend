import { ethers } from "ethers";
import { useEffect, useState, useCallback } from "react";
import { GenericPage } from "./Page";
import { useParams } from "react-router-dom";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { ABIS } from "../common/abis";

import "./treeList.css";
import { Checkbox, Text } from "@geist-ui/react";
import { sleep, truncate } from "../common/utils";

// Default decoder with common abis
const defaultDecoder = new ethers.utils.Interface(ABIS);

// Extract out all function signatures (4bytes)
function getUnknownFunctionSignatures(decoder, stackTrace) {
  const { input, calls } = stackTrace;
  const innerCalls = calls || [];

  // not a call, but probably a LOG, SSTORE opcode
  if (input === undefined) {
    return [];
  }

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

  // not a call, but probably a LOG, SSTORE opcode
  if (from === undefined || to === undefined) {
    return [];
  }

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

function TraceViewer(stackTrace, verbose = false) {
  const {
    // Pretty value
    prettyValue,
    prettyAddress,
    prettyInput,
    prettyOutput,
    prettyLog,

    // Call
    type,
    to,
    gas,
    input,
    output,
    calls,
    error,

    // sstore
    slot,
    before,
    after,

    // topics
    topics,
    data,
  } = stackTrace;

  const prettyValueStr =
    (prettyValue || null) === null
      ? ""
      : `[ETH:${truncate(ethers.utils.formatEther(prettyValue), 6)}]`;

  const prettyGas = parseInt(gas, 16);

  // White by default
  let colorType = "#FFF";
  if (type === "CALL") {
    colorType = "#BB86FC";
  } else if (type === "DELEGATECALL") {
    colorType = "#8A80FF";
  } else if (type === "STATICCALL") {
    colorType = "#03DAC6";
  } else if (type === "CREATE" || type === "CREATE2") {
    colorType = "#018786";
  } else if (type === "SSTORE" || type === "SLOAD") {
    colorType = "#FAA356";
  } else if (type.startsWith("LOG")) {
    colorType = "#A2D2FB";
  }

  if (type === "SSTORE") {
    if (verbose === false) return <></>;

    return (
      <li key={`${JSON.stringify(stackTrace)}`}>
        <span style={{ color: colorType }}>[{type}]</span>
        {`${slot}::${before} -> ${after}`}
      </li>
    );
  }

  if (type.startsWith("LOG")) {
    return (
      <li key={`${JSON.stringify(stackTrace)}`}>
        <span style={{ color: colorType }}>[{type}]</span>
        {prettyLog || `[${topics[0]}](${topics.slice(1).join(",")})::${data}`}
      </li>
    );
  }

  return (
    <li key={`${type}-${isNaN(prettyGas) ? "0" : prettyGas.toString()}`}>
      <details open>
        <summary>
          <span
            onClick={(e) => {
              e.preventDefault();
            }}
            style={{ color: colorType }}
          >
            [{type}]
          </span>
          {prettyValueStr}
          {prettyAddress || to}::{prettyInput || input}
        </summary>
        <ul>
          {(calls || []).length > 0 &&
            calls.map((x) => TraceViewer(x, verbose))}
          {output !== undefined && (
            <li key={`return-${parseInt(gas, 16).toString()}`}>
              return {prettyOutput || output}
            </li>
          )}
          {
            // Sending ETH doesn't return value it seems
            output === undefined && error === undefined && (
              <li key={`return-${type}-${parseInt(gas, 16).toString()}`}>
                return [0x]
              </li>
            )
          }
          {error !== undefined && (
            <li key={`revert-${type}-${parseInt(gas, 16).toString()}`}>
              reverted [{error}]
            </li>
          )}
        </ul>
      </details>
    </li>
  );
}

// Make the contract traces readable
function formatExecutionTrace(decoder, knownContractAddresses, stackTrace) {
  let prettyInput = null;
  let prettyAddress = null;
  let prettyOutput = null;
  let prettyValue = null;
  let prettyLog = null;

  // Logs
  try {
    if (stackTrace.topics) {
      const logDescription = decoder.parseLog({
        topics: stackTrace.topics,
        data: stackTrace.data,
      });

      const logParams = logDescription.eventFragment.inputs
        .map((x) => x.name)
        .filter((x) => x !== null);

      // Sometimes we have the logs
      if (logParams.length > 0) {
        const logArgs = logParams.map((x) => logDescription.args[x]);
        prettyLog =
          logDescription.name +
          "(" +
          logArgs.map((x, idx) => logParams[idx] + "=" + logArgs[idx]) +
          ")";
      } else {
        prettyLog =
          logDescription.name +
          "(" +
          logParams.args.map((x) => x.toString()) +
          ")";
      }
    }
  } catch (e) {}

  // Description and result
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
        txArgs.map((x, idx) => txParams[idx] + "=" + txArgs[idx]) +
        ")";
    } else {
      // Otherwise no params
      prettyInput =
        txDescription.name +
        "(" +
        txDescription.args.map((x) => x.toString()) +
        ")";
    }

    const resultDescription = decoder.decodeFunctionResult(
      txDescription.name,
      stackTrace.output
    );
    const resultParamInfo = decoder
      .getFunction(txDescription.name)
      .outputs.map((x) => x.name)
      .filter((x) => x !== null);

    // We have description!
    if (resultParamInfo.length > 0) {
      prettyOutput =
        "(" +
        resultParamInfo.map(
          (x, idx) => resultParamInfo[idx] + "=" + resultDescription[idx]
        ) +
        ")";
    } else {
      prettyOutput = "(" + resultDescription.map((x) => x.toString()) + ")";
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
    prettyLog,
    calls: (stackTrace.calls || []).map((x) =>
      formatExecutionTrace(decoder, knownContractAddresses, x)
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
  const [executionTrace, setExecutionTrace] = useState(null);
  const [hasUpdatedLocalStorage, setHasUpdatedLocalStorage] = useState(false);
  const [displayVerbose, setDisplayVerbose] = useState(false);

  const getTraces = useCallback(async () => {
    const traceData = await fetch(
      `http://localhost:3001/eth/${txhash}?executionTrace=true`,
      {
        method: "GET",
      }
    )
      .then((x) => x.json())
      .catch(() => null);

    if (traceData === null || traceData.executionTrace === undefined) {
      setInvalidTxHash(true);
      return;
    }

    setExecutionTrace(traceData.executionTrace);
  }, [txhash]);

  const getAddressAndSignaturesAndUpdateExecutionTrace =
    useCallback(async () => {
      // Debounce
      if (hasUpdatedLocalStorage) return;
      setHasUpdatedLocalStorage(true);

      // Get function signatures
      const unknown4s = getUniqueUnkownFunctionSignatures(
        ifaceDecoder,
        executionTrace
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

      // Attempt to get contract address name, rate limited to 5 every 1 second
      const unknownAddresses = getUniqueUnknownAddresses(
        knownContractAddresses,
        executionTrace
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

        // Extract out source code name (very hacky yes)
        const addressesNames = addressesSourceCode
          .map((x) => {
            let name = null;
            try {
              name = x.result[0]["ContractName"];
            } catch (e) {}
            if (name === "") {
              name = null;
            }
            return name;
          })
          .filter((x) => x !== null);

        // Extract out ABI if they exist
        const abisFromEtherscan = addressesSourceCode
          .map((x) => {
            let abi = null;
            try {
              abi = JSON.parse(x.result[0]["ABI"]);
            } catch (e) {
              abi = null;
            }
            if (abi === "") {
              abi = null;
            }
            return abi;
          })
          .filter((x) => x !== null)
          .flat();

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

        // Set a new decoder
        const newIFaceDecoder = new ethers.utils.Interface([
          ...ifaceDecoder.format(),
          ...newKnownSignatures,
          ...new ethers.utils.Interface(abisFromEtherscan).format(),
        ]);
        // Re-format trace data with new data
        const newStackTrace = formatExecutionTrace(
          newIFaceDecoder,
          newKnownContractAddresses,
          executionTrace
        );

        // Finally set all the call data after we've parsed all the
        setExecutionTrace(newStackTrace);
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
      executionTrace,
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
    if (!invalidTxHash && executionTrace === null) {
      getTraces();
    }
    if (!invalidTxHash && executionTrace) {
    }
  }, [getTraces, ifaceDecoder, knownSignatures, invalidTxHash, executionTrace]);

  useEffect(() => {
    if (invalidTxHash) return;
    if (executionTrace === null) return;

    // Get 4byte signatures
    if (!hasUpdatedLocalStorage) {
      getAddressAndSignaturesAndUpdateExecutionTrace();
    }
  }, [
    getAddressAndSignaturesAndUpdateExecutionTrace,
    hasUpdatedLocalStorage,
    invalidTxHash,
    executionTrace,
  ]);

  return (
    <GenericPage>
      <Text h4>
        Execution Trace&nbsp;&nbsp;
        <Checkbox
          checked={displayVerbose}
          onChange={(e) => {
            setDisplayVerbose(e.target.checked);
          }}
        >
          Verbose
        </Checkbox>
      </Text>
      {executionTrace === null && invalidTxHash && (
        <Text h2>Invalid txhash</Text>
      )}
      {executionTrace !== null && (
        <ul className="tree">
          <li key="root">
            <details open>
              <summary>[Sender]{executionTrace.from}</summary>
              <ul>{TraceViewer(executionTrace, displayVerbose)}</ul>
            </details>
          </li>
        </ul>
      )}
    </GenericPage>
  );
};
