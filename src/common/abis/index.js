import ENSAbi from "./ENS.json";
import ERC20Abi from "./ERC20.json";
import ERC721Abi from "./ERC721.json";
import GemSwapAbi from "./GemSwap.json";
import OneInchV4Abi from "./OneInchV4.json";
import SeaportRouterAbi from "./SeaportRouter.json";
import UniswapV2SwapRouterAbi from "./UniswapV2SwapRouter.json";
import UniswapV3Abi from "./UniswapV3.json";
import WETHAbi from "./WETH.json";
import UniswapV3PoolAbi from "./UniswapV3Pool.json";
import UniswapV2PairAbi from "./UniswapV2Pair.json";

// Common ABIs
export const ABIS = [
  ...UniswapV2PairAbi,
  ...UniswapV3PoolAbi,
  ...ENSAbi,
  ...ERC20Abi,
  ...ERC721Abi,
  ...GemSwapAbi,
  ...OneInchV4Abi,
  ...SeaportRouterAbi,
  ...UniswapV2SwapRouterAbi,
  ...UniswapV3Abi,
  ...WETHAbi,
];
