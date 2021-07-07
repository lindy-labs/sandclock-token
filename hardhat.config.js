require('@nomiclabs/hardhat-waffle');
require('@nomiclabs/hardhat-web3');
require('@openzeppelin/hardhat-upgrades');
require('hardhat-deploy');
require('hardhat-deploy-ethers');
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
      url: `wss://mainnet.infura.io/ws/v3/${process.env.INFURA_KEY}`,
      chainId: 1,
      accounts: [process.env.MAINNET_PRIVATE_KEY],
    },
    polygon: {
      url: 'https://rpc-mainnet.matic.network',
      chainId: 137,
      accounts: [process.env.MAINNET_PRIVATE_KEY],
    },
    kovan: {
      url: `wss://kovan.infura.io/ws/v3/${process.env.INFURA_KEY}`,
      chainId: 42,
      accounts: [process.env.TESTNET_PRIVATE_KEY],
    },
    mumbai: {
      url: 'https://rpc-mumbai.matic.today',
      chainId: 80001,
      accounts: [process.env.TESTNET_PRIVATE_KEY],
    },
  },
  solidity: {
    version: '0.7.3',
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
};
