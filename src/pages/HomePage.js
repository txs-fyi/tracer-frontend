import React from "react";
import { Page } from "@geist-ui/react";

export const HomePage = () => {
  return (
    <Page>
      <Page.Header>
        <h2>Header</h2>
      </Page.Header>
      <Page.Content>
        <h2>Hello, Everyone.</h2>
      </Page.Content>
      <Page.Footer>
        <h2>Footer</h2>
      </Page.Footer>
    </Page>
  );
};
