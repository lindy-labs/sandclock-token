const { ethers } = require('hardhat');
const { expect } = require('chai');
const { BigNumber } = require('ethers');
const { time, constants } = require('@openzeppelin/test-helpers');
const { getCurrentTime } = require('./utils');

describe('Vesting', () => {
  let vesting;
  let quartz;
  let owner;
  let alice;
  let bob;
  const batchDuration = 100;
  const batchSize = 100;
  const minStakePeriod = 100;
  const start = 3600;

  beforeEach(async () => {
    [owner, alice, bob] = await ethers.getSigners();

    const Quartz = await ethers.getContractFactory('Quartz');
    quartz = await Quartz.deploy(minStakePeriod);

    const currentTime = await getCurrentTime();
    const Vesting = await ethers.getContractFactory('Vesting');
    vesting = await Vesting.deploy(
      quartz.address,
      currentTime.add(start),
      batchDuration,
      batchSize,
    );
  });

  describe('addClaimable', () => {
    it('increases the claimable amount for a given beneficiary', async () => {
      expect(await vesting.claimable(alice.address)).to.equal(0);

      await quartz.transfer(vesting.address, 10);
      await vesting.addClaimable(alice.address, 10);

      expect(await vesting.claimable(owner.address)).to.equal(0);
      expect(await vesting.claimable(alice.address)).to.equal(10);
    });

    it('emits a ClaimAdded even', async () => {
      await quartz.transfer(vesting.address, 10);
      const action = vesting.addClaimable(alice.address, 10);

      await expect(action)
        .to.emit(vesting, 'ClaimAdded')
        .withArgs(alice.address, 10);
    });

    it('fails if contract does not have enough tokens', async () => {
      await quartz.transfer(vesting.address, 9);
      const action = vesting.addClaimable(alice.address, 10);

      await expect(action).to.be.revertedWith('not enough tokens on contract');
    });

    it('updates totalClaimable', async () => {
      await quartz.transfer(vesting.address, 11);

      await vesting.addClaimable(alice.address, 10);
      expect(await vesting.totalClaimable()).to.equal(10);

      await vesting.addClaimable(owner.address, 1);
      expect(await vesting.totalClaimable()).to.equal(11);
    });
  });

  describe('currentlyClaimable', () => {
    it('is zero before the start batch', async () => {
      await quartz.transfer(vesting.address, 11);
      await vesting.addClaimable(alice.address, 10);

      expect(await vesting.currentlyClaimable(alice.address)).to.equal(0);
    });

    it('increases with each batch', async () => {
      await quartz.transfer(vesting.address, 1000);
      await vesting.addClaimable(alice.address, 1000);

      await time.increase(start);

      for (let amount = batchSize; amount <= 1000; amount += batchSize) {
        expect(await vesting.currentlyClaimable(alice.address)).to.equal(
          amount,
        );

        await time.increase(batchDuration);
      }

      expect(await vesting.currentlyClaimable(alice.address)).to.equal(1000);
    });

    it('takes the claimed amount into account', async () => {
      await quartz.transfer(vesting.address, 1000);
      await vesting.addClaimable(alice.address, 1000);

      await time.increase(start);
      await vesting.claim(alice.address);
      await time.increase(batchDuration);

      expect(await vesting.currentlyClaimable(alice.address)).to.equal(
        batchSize,
      );

      await vesting.claim(alice.address);

      expect(await vesting.currentlyClaimable(alice.address)).to.equal(0);
    });
  });

  describe('claim', () => {
    it('allows a beneficiary to claim his amount', async () => {
      await quartz.transfer(vesting.address, 11);
      await vesting.addClaimable(bob.address, 1);

      await vesting.addClaimable(alice.address, 10);

      await time.increase(start);
      await vesting.claim(alice.address);

      expect(await quartz.balanceOf(alice.address)).to.equal(10);
      expect(await vesting.claimable(alice.address)).to.equal(0);
      expect(await vesting.claimed(alice.address)).to.equal(10);
      expect(await vesting.totalClaimable()).to.equal(1);
      expect(await vesting.totalClaimed()).to.equal(10);
    });

    it('emits a Claimed event', async () => {
      await quartz.transfer(vesting.address, 1);
      await vesting.addClaimable(alice.address, 1);

      await time.increase(start);
      const action = vesting.claim(alice.address);

      await expect(action)
        .to.emit(vesting, 'Claimed')
        .withArgs(alice.address, 1);
    });

    it('fails if claimable amount is zero', async () => {
      const action = vesting.claim(alice.address);

      await expect(action).to.be.revertedWith('no tokens to claim');
    });
  });
});
