const deployQuartz = async function ({ deployments, getNamedAccounts }) {
  const chainId = await getChainId();
  if (chainId !== '137' && chainId !== '80001') {
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
