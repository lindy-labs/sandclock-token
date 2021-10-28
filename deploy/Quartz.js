const deployQuartz = async function ({ deployments, getNamedAccounts }) {
  const chainId = await getChainId();
  if (chainId !== '100' && chainId !== '80001' && chainId !== '4') {
    throw Error('Unsupported chain');
  }

  const { deploy } = deployments;
  const { deployer, childChainProxy } = await getNamedAccounts();

  const minStakePeriod = 3600 * 24 * 30;

  const ProxyAdmin = await ethers.getContract('ProxyAdmin');

  await deploy('Quartz', {
    from: deployer,
    args: [],
    log: true,
    deterministicDeployment: false,
    proxy: {
      owner: ProxyAdmin.address,
      proxyContract: 'TransparentUpgradeableProxy',
    },
  });

  const Quartz = await ethers.getContract('Quartz');

  await Quartz.initialize(minStakePeriod, childChainProxy);
};

module.exports = deployQuartz;
module.exports.tags = ['Quartz'];
