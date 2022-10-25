import React from "react";
import { Page, Text, Link } from "@geist-ui/react";
import { Github } from "@geist-ui/icons";
import logo from "../logo.png";

export const GenericPage = (props) => {
  return (
    <Page>
      <Page.Header>
        <div
          style={{
            marginTop: "25px",
            textAlign: "center",
            alignItems: "center",
          }}
        >
          <a href="/">
            <img alt="logo" width="64px" src={logo} />
          </a>
          <Text style={{ marginBottom: "0px" }} h2>
            txs.fyi
          </Text>
          <Text style={{ marginTop: "0px" }} type="secondary">
            Transactions, For Your Information
          </Text>
        </div>
      </Page.Header>
      <Page.Content>{props.children}</Page.Content>
      <Page.Footer>
        <div style={{ float: "right" }}>
          <Link href="https://github.com/txs-fyi/tracer-frontend">
            <Github />
          </Link>
        </div>
      </Page.Footer>
    </Page>
  );
};
