const { ethers } = require('hardhat');
const { expect } = require('chai');
const { BigNumber } = require('ethers');
const { time, constants } = require('@openzeppelin/test-helpers');
const { getCurrentTime } = require('./utils');

describe('vested', () => {
  let quartz;
  let vested;
  let VestedRewards;
  let owner;
  let alice;
  let bob;
  let currentTime;
  const minStakePeriod = 100;
  const start = 3600;
  const duration = 86400;

  beforeEach(async () => {
    [owner, alice, bob] = await ethers.getSigners();

    const Quartz = await ethers.getContractFactory('Quartz');
    quartz = await Quartz.deploy(minStakePeriod);

    currentTime = await getCurrentTime();
    VestedRewards = await ethers.getContractFactory('VestedRewards');
    vested = await VestedRewards.deploy(
      quartz.address,
      currentTime.add(start),
      duration,
    );
  });

  describe('constructor', () => {
    it('sets the given params', async () => {
      const start = currentTime.add(3600);
      const duration = 2;
      const vested2 = await VestedRewards.deploy(
        quartz.address,
        start,
        duration,
      );

      expect(await vested2.quartz()).to.equal(quartz.address);
      expect(await vested2.start()).to.equal(start);
      expect(await vested2.duration()).to.equal(duration);
    });

    it('fails is start date is in the past', async () => {
      const start = currentTime.sub(1);
      const duration = 2;
      const action = VestedRewards.deploy(quartz.address, start, duration);

      await expect(action).to.be.revertedWith(
        'start date cannot be in the past',
      );
    });

    it('fails is duration is zero', async () => {
      const start = currentTime.add(3600);
      const duration = 0;
      const action = VestedRewards.deploy(quartz.address, start, duration);

      await expect(action).to.be.revertedWith('duration cannot be 0');
    });
  });

  describe('deposit', () => {
    it('mints new vestedQUARTZ', async () => {
      await quartz.approve(vested.address, 100);

      await vested.deposit(100);

      expect(await vested.balanceOf(owner.address)).to.equal(100);
    });

    it('withdraws QUARTZ from the sender', async () => {});
  });

  it('does not allow deposits after start date', async () => {
    await time.increase(start + duration);

    const action = vested.deposit(100);

    await expect(action).to.be.revertedWith('already started');
  });

  it('fails if it cannot transfer QUARTZ from sender', async () => {
    const action = vested.deposit(100);

    await expect(action).to.be.revertedWith(
      'transfer amount exceeds allowance',
    );
  });
});
