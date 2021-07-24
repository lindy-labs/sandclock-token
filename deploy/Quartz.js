const deployQuartz = async function ({ deployments, getNamedAccounts }) {
  const chainId = await getChainId();
  if (chainId !== '100' && chainId !== '80001' && chainId !== '4') {
    throw Error('Unsupported chain');
  }

  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  await deploy('Quartz', {
    from: deployer,
    args: [],
    log: true,
  });
};

module.exports = deployQuartz;
module.exports.tags = ['Quartz'];
