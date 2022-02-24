const deployQuartzToken = async function ({ deployments, getNamedAccounts }) {
  const chainId = await getChainId();
  if (chainId !== '1' && chainId !== '4') {
    throw Error('Unsupported chain');
  }

  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  await deploy('QuartzToken', {
    from: deployer,
    args: [],
    log: true,
  });
};

module.exports = deployQuartzToken;
module.exports.tags = ['QuartzToken'];
