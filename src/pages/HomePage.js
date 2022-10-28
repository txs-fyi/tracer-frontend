import React, { useCallback, useEffect, useState } from "react";
import { GenericPage } from "./Page";
import {
  ButtonDropdown,
  Input,
  Spacer,
  Text,
  Loading,
  Pagination,
} from "@geist-ui/react";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { ChevronRight, ChevronLeft } from "@geist-ui/icons";

import "./treeList.css";

export const HomePage = () => {
  const [invalidTxHash, setInvalidTxHash] = useState(false);
  const [txHash, setTxHash] = useState("");
  const [analyticsData, setAnalyticsData] = useState(null);
  const [formattedAnalyticsData, setFormattedAnalyticsData] = useState(null);
  const [curPage, setCurPage] = useState(0);
  const [knownIds, setKnownIds] = useLocalStorage("knownIds", []);

  const getFuncNames = useCallback(async () => {
    const unknown4s = Object.keys(analyticsData.data)
      .slice(curPage * 100, (curPage + 1) * 100)
      .filter((x) => knownIds[x] === undefined);
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

    setKnownIds({
      ...knownIds,
      ...hexSigsResFlattened.reduce((acc, x) => {
        return {
          [x.hex_signature]: x.text_signature,
          ...acc,
        };
      }, {}),
    });
  }, [analyticsData, curPage, knownIds, setKnownIds]);

  const getAnalyticsData = useCallback(async () => {
    const analData = await fetch("https://analytics.txs.fyi").then((x) =>
      x.json()
    );

    /*
    {
      data: {
        '0x12345': {
          'txHash': count,
        },
      }
    }

    becomes (ordered, descending)

    [
      {'0x12345678': {
        data: [
          {txHash: txHash, count: 10},
          ...,
        ],
        count: 10
      }
    ]
    */
    const { data } = analData;
    const funcSigs = Object.keys(data);
    const funcSigArray = funcSigs
      .reduce((acc, x) => {
        const curData = Object.keys(data[x])
          .reduce((acc2, y) => {
            acc2.push({
              txHash: y,
              count: data[x][y],
            });
            return acc2;
          }, [])
          .sort((a, b) => b.count - a.count);

        const obj = {
          funcSig: x,
          data: curData,
          count: Object.keys(data[x]).reduce((acc2, y) => acc2 + data[x][y], 0),
        };

        acc.push(obj);

        return acc;
      }, [])
      .sort((a, b) => {
        return b.count - a.count;
      });

    setFormattedAnalyticsData(funcSigArray);
    setAnalyticsData(analData);
  }, []);

  useEffect(() => {
    if (analyticsData === null) {
      getAnalyticsData();
    }
  }, [analyticsData, getAnalyticsData]);

  useEffect(() => {
    if (analyticsData !== null && curPage !== null) {
      getFuncNames();
      console.log("here");
    }
  }, [curPage]);

  return (
    <GenericPage>
      <Text h3>Execution Trace</Text>
      <Input
        value={txHash}
        onChange={(e) => {
          setTxHash(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            if (!txHash.startsWith("0x") || txHash.length !== 66) {
              setInvalidTxHash(true);
              return;
            }

            setInvalidTxHash(false);

            // eslint-disable-next-line
            location.assign(`/eth/${txHash}`);
          }
        }}
        type={invalidTxHash ? "error" : "default"}
        scale={4 / 3}
        width="100%"
        placeholder="Transaction hash"
      >
        {invalidTxHash && <Text type="error">Invalid tx hash</Text>}
      </Input>
      <Spacer />
      <div style={{ width: "100%" }}>
        <div style={{ float: "right" }}>
          <ButtonDropdown>
            <ButtonDropdown.Item main>Ethereum Mainnet</ButtonDropdown.Item>
          </ButtonDropdown>
        </div>
      </div>
      <Spacer height={3} />

      <Text h3>Interesting Data</Text>
      {analyticsData === null && (
        <Loading>Fetching interesting data...</Loading>
      )}
      {analyticsData !== null && (
        <Text type="subtitle">
          Last updated block: {analyticsData.lastBlock}, keeps last 100 block
        </Text>
      )}
      {formattedAnalyticsData !== null && (
        <Pagination
          count={parseInt(formattedAnalyticsData.length / 100)}
          initialPage={curPage + 1}
          onChange={(e) => setCurPage(e)}
        >
          <Pagination.Next>
            <ChevronRight />
          </Pagination.Next>
          <Pagination.Previous>
            <ChevronLeft />
          </Pagination.Previous>
        </Pagination>
      )}
      {formattedAnalyticsData !== null &&
        formattedAnalyticsData
          .slice(curPage * 100, (curPage + 1) * 100)
          .map((x) => {
            return (
              <ul className="tree">
                <li key={x.funcSig}>
                  <details>
                    <summary>
                      <span
                        onClick={(e) => {
                          e.preventDefault();
                          navigator.clipboard.writeText(x.funcSig);
                        }}
                      >
                        {x.funcSig}{" "}
                        {knownIds[x.funcSig] === undefined
                          ? ""
                          : "[" + knownIds[x.funcSig].split("(")[0] + "]"}{" "}
                        ({x.count})
                      </span>
                    </summary>
                    <ul key={`${x.funcSig}-ul`}>
                      {x.data.map((y) => {
                        return (
                          <li key={`${x.funcSig}-${y.txHash}-${y.count}`}>
                            <a href={`https://etherscan.io/tx/${y.txHash}`}>
                              {y.txHash}
                            </a>{" "}
                            ({y.count})
                          </li>
                        );
                      })}
                    </ul>
                  </details>
                </li>
              </ul>
            );
          })}
      {formattedAnalyticsData !== null && (
        <Pagination
          count={parseInt(formattedAnalyticsData.length / 100)}
          initialPage={curPage + 1}
          onChange={(e) => setCurPage(e)}
        >
          <Pagination.Next>
            <ChevronRight />
          </Pagination.Next>
          <Pagination.Previous>
            <ChevronLeft />
          </Pagination.Previous>
        </Pagination>
      )}
    </GenericPage>
  );
};
