import React, { useState } from "react";
import { GenericPage } from "./Page";
import { ButtonDropdown, Input, Spacer, Text } from "@geist-ui/react";

export const HomePage = () => {
  const [invalidTxHash, setInvalidTxHash] = useState(false);
  const [txHash, setTxHash] = useState("");

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
    </GenericPage>
  );
};
