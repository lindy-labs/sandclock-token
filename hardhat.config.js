require('@nomiclabs/hardhat-waffle');
require('@nomiclabs/hardhat-web3');
require('@nomiclabs/hardhat-etherscan');
require('hardhat-deploy');
require('hardhat-deploy-ethers');
require('hardhat-gas-reporter');
require('hardhat-contract-sizer');
require('solidity-coverage');
require('@openzeppelin/hardhat-upgrades');
require('hardhat-dependency-compiler');
require('dotenv').config();

module.exports = {
  contractSizer: {
    runOnCompile: true,
    disambiguatePaths: false,
  },
  networks: {
    hardhat: {
      gas: 10000000,
      accounts: {
        accountsBalance: '100000000000000000000000000',
      },
      // allowUnlimitedContractSize: true,
      timeout: 1000000,
    },
    mainnet: {
      url: `https://mainnet.infura.io/v3/${process.env.INFURA_KEY}`,
      chainId: 1,
      accounts: [process.env.MAINNET_PRIVATE_KEY],
    },
    polygon: {
      url: 'https://polygon-mainnet.g.alchemy.com/v2/GuyiRadC4DOQjEPb9HvpdDrkv11PRRXa',
      chainId: 137,
      accounts: [process.env.MAINNET_PRIVATE_KEY],
    },
    rinkeby: {
      url: `https://rinkeby.infura.io/v3/${process.env.INFURA_KEY}`,
      chainId: 4,
      accounts: [process.env.TESTNET_PRIVATE_KEY],
      gas: 10000000,
    },
    mumbai: {
      url: 'https://rpc-mumbai.maticvigil.com/',
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
    childChainProxy: {
      137: '0xA6FA4fB5f76172d178d61B04b0ecd319C5d1C0aa',
      80001: 0,
    },
  },
  gasReporter: {
    currency: 'ETH',
    gasPrice: 21,
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
  dependencyCompiler: {
    paths: [
      '@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol',
      '@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol',
    ],
  },
};
