require('@nomiclabs/hardhat-waffle');
require('@nomiclabs/hardhat-web3');
require("@nomiclabs/hardhat-etherscan");
require('@openzeppelin/hardhat-upgrades');
require('hardhat-deploy');
require('hardhat-deploy-ethers');
require('hardhat-gas-reporter');
require('solidity-coverage');
require('dotenv').config();

module.exports = {
  networks: {
    hardhat: {
      gas: 10000000,
      accounts: {
        accountsBalance: '100000000000000000000000000',
      },
      allowUnlimitedContractSize: true,
      timeout: 1000000,
    },
    mainnet: {
      url: `https://mainnet.infura.io/v3/${process.env.INFURA_KEY}`,
      chainId: 1,
      accounts: [process.env.MAINNET_PRIVATE_KEY],
    },
    polygon: {
      url: 'https://rpc-mainnet.matic.network',
      chainId: 137,
      accounts: [process.env.MAINNET_PRIVATE_KEY],
    },
    rinkeby: {
      url: `https://rinkeby.infura.io/v3/${process.env.INFURA_KEY}`,
      chainId: 4,
      accounts: [process.env.TESTNET_PRIVATE_KEY],
    },
    mumbai: {
      url: 'https://rpc-mumbai.matic.today',
      chainId: 80001,
      accounts: [process.env.TESTNET_PRIVATE_KEY],
    },
    xdai: {
      url: 'https://rpc.xdaichain.com/',
      chainId: 100,
      accounts: [process.env.TESTNET_PRIVATE_KEY],
    },
  },
  solidity: {
    version: '0.8.9',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  namedAccounts: {
    deployer: {
      default: 0,
    },
  },
  gasReporter: {
    currency: 'ETH',
    gasPrice: 21,
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY
  }
};
