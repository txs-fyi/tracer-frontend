import React from "react";
import { Page } from "@geist-ui/react";
import { useParams } from "react-router-dom";
import "./treeList.css";

export const TracePage = () => {
  const {txhash} = useParams();

  return (
    <Page>
      <Page.Header>
        <h2>Header</h2>
      </Page.Header>
      <Page.Content>
        <h2>Hello {txhash}.</h2>

        <ul className="tree">
          <li>
            <details open>
              <summary>Giant planets</summary>
              <ul>
                <li>
                  <details>
                    <summary>Gas giants</summary>
                    <ul>
                      <li>Jupiter</li>
                      <li>Saturn</li>
                    </ul>
                  </details>
                </li>
                <li>
                  <details>
                    <summary>Ice giants</summary>
                    <ul>
                      <li>Uranus</li>
                      <li>Neptune</li>
                    </ul>
                  </details>
                </li>
              </ul>
            </details>
          </li>
        </ul>
      </Page.Content>
      <Page.Footer>
        <h2>Footer</h2>
      </Page.Footer>
    </Page>
  );
};
