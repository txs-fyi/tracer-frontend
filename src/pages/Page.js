import React from "react";
import { Page, Image, Display, Text } from "@geist-ui/react";
import logo from "../logo.png";

export const GenericPage = (props) => {
  return (
    <Page>
      <Page.Header>
        <Display>
          <Image width="64px" src={logo} />
          <Text h2>txs.fyi</Text>
        </Display>
      </Page.Header>
      <Page.Content>{props.children}</Page.Content>
    </Page>
  );
};
