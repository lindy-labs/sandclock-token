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
  const startDelay = 3600;
  const duration = 7776000; // 90 days
  const gracePeriod = 2592000; // 30 days

  beforeEach(async () => {
    [owner, alice, bob] = await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory('MockERC20');
    quartz = await MockERC20.deploy();

    currentTime = await getCurrentTime();
    VestedRewards = await ethers.getContractFactory('VestedRewards');
    vested = await VestedRewards.deploy(
      quartz.address,
      currentTime.add(startDelay),
      duration,
      gracePeriod,
    );
  });

  describe('constructor', () => {
    it('sets the given params', async () => {
      const startDelay = currentTime.add(3600);
      const duration = 2;
      const vested2 = await VestedRewards.deploy(
        quartz.address,
        startDelay,
        duration,
        gracePeriod,
      );

      expect(await vested2.quartz()).to.equal(quartz.address);
      expect(await vested2.start()).to.equal(startDelay);
      expect(await vested2.duration()).to.equal(duration);
    });

    it('fails if start date is in the past', async () => {
      const startDelay = currentTime.sub(1);
      const duration = 2;
      const action = VestedRewards.deploy(
        quartz.address,
        startDelay,
        duration,
        gracePeriod,
      );

      await expect(action).to.be.revertedWith(
        'start date cannot be in the past',
      );
    });

    it('fails if duration is zero', async () => {
      const startDelay = currentTime.add(3600);
      const duration = 0;
      const action = VestedRewards.deploy(
        quartz.address,
        startDelay,
        duration,
        gracePeriod,
      );

      await expect(action).to.be.revertedWith('duration cannot be 0');
    });
  });

  describe('deposit', () => {
    it('mints new vestedQUARTZ', async () => {
      await quartz.approve(vested.address, 100);

      await vested.deposit(100);

      expect(await vested.balanceOf(owner.address)).to.equal(100);
    });

    it('withdraws QUARTZ from the sender', async () => {
      await quartz.approve(vested.address, 100);

      const balanceBefore = await quartz.balanceOf(owner.address);
      await vested.deposit(100);
      const balanceAfter = await quartz.balanceOf(owner.address);

      expect(balanceAfter).to.eq(balanceBefore.sub(100));
    });
  });

  it('does not allow deposits after start date', async () => {
    await time.increase(startDelay + duration);

    const action = vested.deposit(100);

    await expect(action).to.be.revertedWith('already started');
  });

  it('fails if it cannot transfer QUARTZ from sender', async () => {
    const action = vested.deposit(100);

    await expect(action).to.be.revertedWith(
      'transfer amount exceeds allowance',
    );
  });

  describe('withdraw', () => {
    it('cannot withdraw anything before startDelay', async () => {
      await quartz.approve(vested.address, 100);
      await vested.deposit(100);

      expect(await vested.withdrawable(owner.address)).to.equal(0);
    });

    it('can withdraw the full amount after the full period', async () => {
      await quartz.approve(vested.address, 100);
      await vested.deposit(100);

      await time.increase(startDelay + duration);

      expect(await vested.withdrawable(owner.address)).to.equal(100);
    });

    it('can withdraw 10% of the amount after 10% of the period', async () => {
      await quartz.approve(vested.address, 100);
      await vested.deposit(100);

      await time.increase(startDelay + duration * 0.1);

      expect(await vested.withdrawable(owner.address)).to.equal(10);
    });

    it('can withdraw 56% of the amount after 56% of the period', async () => {
      await quartz.approve(vested.address, 100);
      await vested.deposit(100);

      await time.increase(startDelay + duration * 0.56);

      expect(await vested.withdrawable(owner.address)).to.equal(56);
    });

    it("withdrawals are limited by sender's vestedQUARTZ balance", async () => {
      await quartz.approve(vested.address, 100);
      await vested.deposit(100);
      await vested.transfer(alice.address, 40);

      await time.increase(startDelay + duration);

      expect(await vested.withdrawable(owner.address)).to.equal(60);
      expect(await vested.withdrawable(alice.address)).to.equal(40);
    });

    it('is always 0 for contracts', async () => {
      await quartz.approve(vested.address, 100);
      await vested.deposit(100);
      await vested.transfer(quartz.address, 100);

      await time.increase(startDelay + duration);

      expect(await vested.withdrawable(quartz.address)).to.equal(0);
    });
  });

  describe('transfer', () => {
    it('allows outgoing transfers for accounts that have not yet redeemed vestedQUARTZ', async () => {
      await quartz.approve(vested.address, 100);
      await vested.deposit(100);
      await vested.transfer(alice.address, 100);

      await time.increase(startDelay + duration * 0.1);

      await vested.connect(alice).transfer(bob.address, 1);

      expect(await vested.balanceOf(bob.address)).to.equal(1);
    });

    it('does not allow outgoing transfers for accounts that have redeemed vestedQUARTZ', async () => {
      await quartz.approve(vested.address, 100);
      await vested.deposit(100);
      await vested.transfer(alice.address, 100);

      await time.increase(startDelay + duration * 0.1);
      await vested.connect(alice).withdraw();

      const tx = vested.connect(alice).transfer(bob.address, 1);

      await expect(tx).to.be.revertedWith(
        'outgoing transfers are locked for this account',
      );
    });
  });

  describe('clawback', () => {
    it('allows withdrawing any remaining QUARTZ after the grace period', async () => {
      await quartz.approve(vested.address, 100);
      await vested.deposit(100);
      await vested.transfer(alice.address, 25);
      await vested.transfer(bob.address, 75);

      await time.increase(startDelay + duration + gracePeriod);

      await vested.connect(alice).withdraw();

      const balanceBefore = await quartz.balanceOf(owner.address);
      await vested.clawback();
      const balanceAfter = await quartz.balanceOf(owner.address);

      expect(balanceAfter).to.equal(balanceBefore.add(75));
      expect(await quartz.balanceOf(vested.address)).to.equal(0);
    });

    it('selfdestructs the contract', async () => {
      await quartz.approve(vested.address, 100);
      await vested.deposit(100);

      await time.increase(startDelay + duration + gracePeriod);

      await vested.clawback();

      const tx = vested.balanceOf(owner.address);

      await expect(tx).to.be.revertedWith('call revert exception');
    });

    it('fails if called before the end of grace period', async () => {
      await quartz.approve(vested.address, 100);
      await vested.deposit(100);
      await vested.transfer(alice.address, 25);
      await vested.transfer(bob.address, 75);

      await time.increase(startDelay + duration + gracePeriod * 0.9);

      const tx = vested.clawback();

      await expect(tx).to.be.revertedWith('grace period not over yet');
    });
  });
});
