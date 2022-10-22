import "./Trace.css";

export const Trace = () => {
  return (
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
  );
};
