require("@nomiclabs/hardhat-waffle");
require("dotenv").config();
require("@nomiclabs/hardhat-etherscan");
require("solidity-coverage");
require("@openzeppelin/hardhat-upgrades");

const INFURA_API_KEY = process.env.INFURA_API_KEY || "";
const KOVAN_PRIVATE_KEY = process.env.KOVAN_PRIVATE_KEY || "";
const RINKEBY_PRIVATE_KEY = process.env.RINKEBY_PRIVATE_KEY || "";
const BSC_PRIVATE_KEY = process.env.BSC_PRIVATE_KEY || "";
const MAINNET_PRIVATE_KEY = process.env.MAINNET_PRIVATE_KEY || "";
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";
const POLYGON_PRIVATE_KEY = process.env.POLYGON_PRIVATE_KEY || "";

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
    const accounts = await hre.ethers.getSigners();

    for (const account of accounts) {
        console.log(account.address);
    }
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
    solidity: {
        compilers: [
            {
                version: "0.8.9",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200,
                    },
                },
            },
        ],
    },
    defaultNetwork: "hardhat",
    networks: {
        hardhat: {},
        kovan: {
            url: `https://kovan.infura.io/v3/${INFURA_API_KEY}`,
            accounts: [KOVAN_PRIVATE_KEY],
        },
        mainnet: {
            url: `https://mainnet.infura.io/v3/${INFURA_API_KEY}`,
            accounts: [MAINNET_PRIVATE_KEY],
        },
        rinkeby: {
            url: `https://rinkeby.infura.io/v3/${INFURA_API_KEY}`,
            accounts: [RINKEBY_PRIVATE_KEY],
        },
        BSCTest: {
            url: "https://data-seed-prebsc-1-s1.binance.org:8545/",
            accounts: [KOVAN_PRIVATE_KEY],
        },
        BSC: {
            url: "https://bsc-dataseed.binance.org/",
            accounts: [BSC_PRIVATE_KEY],
        },
        mumbai: {
            url: `https://polygon-mumbai.g.alchemy.com/v2/Cd1wv_mFnI3EFCZ09YeHkXWMrRHrtc22`,
            accounts: [POLYGON_PRIVATE_KEY],
        },
    },
    etherscan: {
        //@ts-ignore
        url: "https://api-rinkeby.etherscan.io/api",
        apiKey: ETHERSCAN_API_KEY,
    },
};
