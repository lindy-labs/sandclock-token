const deployQuartzL1 = async function ({ deployments, getNamedAccounts }) {
  const chainId = await getChainId();
  if (chainId !== '1' && chainId !== '42') {
    throw Error('Unsupported chain');
  }

  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  await deploy('QuartzL1', {
    from: deployer,
    args: [],
    log: true,
  });
};

module.exports = deployQuartzL1;
module.exports.tags = ['QuartzL1'];
