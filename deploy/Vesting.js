module.exports = async function deployQuartz({
  deployments,
  getNamedAccounts,
}) {
  const chainId = await getChainId();

  if (chainId !== '80001') {
    throw Error('Unsupported chain');
  }

  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const quartzAddress = (await deployments.get('QuartzToken')).address;

  const start = Math.floor(new Date().getTime() / 1000) + 5 * 60; // in 5 minutes
  const startAmount = 100;
  const batchDuration = 100;
  const batchSize = 100;

  await deploy('Vesting', {
    from: deployer,
    args: [quartzAddress, start, startAmount, batchDuration, batchSize],
    log: true,
  });
};

module.exports.tags = ['Vesting'];
