const hre = require('hardhat');
const { BigNumber } = require('ethers');

const quartzAddress = '0x7B89414F14a7B9090Cc5f0Abf7F524255b10139a';
const quartzGovernorAddress = '0xd62dc2C2831cBF5600895675A33791B2ed2AdC01';

async function main() {
  const Quartz = await hre.ethers.getContractFactory('Quartz');
  const quartz = Quartz.attach(quartzAddress);
  // await quartz.setGovernor(quartzGovernorAddress)
  await quartz.stake(
    '10000000000000000000000',
    '0x3b49Fb04013A652537b24aE650d14653F6e2355c',
    86400,
  ); // 10k QUARTZ

  // const QuartzGovernor = await hre.ethers.getContractFactory('QuartzGovernor');
  // const quartzGovernor = QuartzGovernor.attach(quartzGovernorAddress);
  // console.log((await quartzGovernor.CREATE_PROPOSALS_ROLE()).toString())
  // await quartzGovernor.grantRole(
  //   '0xbf05b9322505d747ab5880dfb677dc4864381e9fc3a25ccfa184a3a53d02f4b2',
  //   '0xFC0Fb7c5ecDC08FAE522372c385577c09ca64C3c',
  // );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
