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
  let startTime;
  const batchDuration = 100;
  const batchSize = 100;
  const start = 3600;
  const startAmount = 100;

  beforeEach(async () => {
    [owner, alice, bob] = await ethers.getSigners();

    const Quartz = await ethers.getContractFactory('QuartzToken');
    quartz = await Quartz.deploy();

    startTime = (await getCurrentTime()).add(start);
    const Vesting = await ethers.getContractFactory('Vesting');
    vesting = await Vesting.deploy(
      quartz.address,
      startTime,
      startAmount,
      batchDuration,
      batchSize,
    );
  });

  describe('constructor', () => {
    it('doesnt allow the start to be in the past', async () => {
      const timeInThePast = (await getCurrentTime()).sub(1);

      const Vesting = await ethers.getContractFactory('Vesting');

      const action = Vesting.deploy(
        quartz.address,
        timeInThePast,
        startAmount,
        batchDuration,
        batchSize,
      );

      await expect(action).to.be.revertedWith('start cannot be in the past');
    });
  });

  describe('withdrawExcess', () => {
    it('withdraws the exceess tokens in the contract', async () => {
      await quartz.transfer(vesting.address, 2000);
      await vesting.addClaimable(alice.address, 1000);

      await vesting.withdrawExcess();

      const totalClaimable = await quartz.balanceOf(vesting.address);
      expect(totalClaimable.toString()).to.equal('1000');
    });

    it('fails if there is not excess to withdraw', async () => {
      await quartz.transfer(vesting.address, 1000);
      await vesting.addClaimable(alice.address, 1000);

      const action = vesting.withdrawExcess();

      await expect(action).to.be.revertedWith('nothing to withdraw');

      const totalClaimable = await quartz.balanceOf(vesting.address);
      expect(totalClaimable.toString()).to.equal('1000');
    });

    it('fails if not the owner calling', async () => {
      await quartz.transfer(vesting.address, 2000);
      await vesting.addClaimable(alice.address, 1000);

      const action = vesting.connect(alice).withdrawExcess();

      await expect(action).to.be.reverted;

      const totalClaimable = await quartz.balanceOf(vesting.address);
      expect(totalClaimable.toString()).to.equal('2000');
    });
  });

  describe('changeBatches', () => {
    it('updates the configuration', async () => {
      await quartz.transfer(vesting.address, 1000);
      await vesting.addClaimable(alice.address, 1000);

      expect(await vesting.start()).to.equal(startTime);
      expect(await vesting.startAmount()).to.equal(startAmount);
      expect(await vesting.batchDuration()).to.equal(batchDuration);
      expect(await vesting.batchSize()).to.equal(batchSize);

      const newTime = startTime.add(100);
      await vesting.changeBatches(newTime, 200, 200, 200);

      expect(await vesting.start()).to.equal(newTime);
      expect(await vesting.startAmount()).to.equal(200);
      expect(await vesting.batchDuration()).to.equal(200);
      expect(await vesting.batchSize()).to.equal(200);
    });

    it('ensures that the startAmount cannot be less than the current claimable amount after it starts', async () => {
      await quartz.transfer(vesting.address, 1000);
      await vesting.addClaimable(alice.address, 1000);

      await time.increase(start);
      const newTime = (await getCurrentTime()).add(100);
      await vesting.changeBatches(newTime, 0, 200, 200);

      // the start amount is 100 because the first batch is already available to be claimed
      expect(await vesting.startAmount()).to.equal(100);

      await vesting.changeBatches(newTime, 300, 200, 200);

      expect(await vesting.startAmount()).to.equal(300);
    });

    it('requires the start to be in the future', async () => {
      await quartz.transfer(vesting.address, 1000);
      await vesting.addClaimable(alice.address, 1000);

      const newTime = await getCurrentTime();
      const action = vesting.changeBatches(newTime, 0, 200, 200);

      await expect(action).to.be.revertedWith('start cannot be in the past');
    });

    it('emits a ConfigurationChanged event', async () => {
      await quartz.transfer(vesting.address, 10);
      await vesting.addClaimable(alice.address, 10);

      const newTime = (await getCurrentTime()).add(1);
      const action = vesting.changeBatches(newTime, 0, 200, 200);

      await expect(action)
        .to.emit(vesting, 'ConfigurationChanged')
        .withArgs(newTime, 0, 200, 200);
    });
  });

  describe('addUniqueClaimable', () => {
    it('increases the claimable amount for a given beneficiary', async () => {
      expect(await vesting.claimable(alice.address)).to.equal(0);

      await quartz.transfer(vesting.address, 10);
      await vesting.addUniqueClaimable(alice.address, 10);

      expect(await vesting.claimable(owner.address)).to.equal(0);
      expect(await vesting.claimable(alice.address)).to.equal(10);
    });

    it('emits a ClaimAdded event', async () => {
      await quartz.transfer(vesting.address, 10);
      const action = vesting.addUniqueClaimable(alice.address, 10);

      await expect(action)
        .to.emit(vesting, 'ClaimAdded')
        .withArgs(alice.address, 10);
    });

    it('updates totalClaimable', async () => {
      await quartz.transfer(vesting.address, 11);

      await vesting.addUniqueClaimable(alice.address, 10);
      expect(await vesting.totalClaimable()).to.equal(10);

      await vesting.addUniqueClaimable(owner.address, 1);
      expect(await vesting.totalClaimable()).to.equal(11);
    });

    it('fails if the beneficiary already has a claimable amount', async () => {
      await vesting.addUniqueClaimable(alice.address, 10);

      const action = vesting.addUniqueClaimable(alice.address, 10);

      await expect(action).to.be.revertedWith(
        'the beneficiary already has a claimable amount',
      );
    });
  });

  describe('addClaimable', () => {
    it('increases the claimable amount for a given beneficiary', async () => {
      expect(await vesting.claimable(alice.address)).to.equal(0);

      await quartz.transfer(vesting.address, 10);
      await vesting.addClaimable(alice.address, 10);

      expect(await vesting.claimable(owner.address)).to.equal(0);
      expect(await vesting.claimable(alice.address)).to.equal(10);
    });

    it('emits a ClaimAdded event', async () => {
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
    it('is zero before the start', async () => {
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

    it('takes configuration changes into account', async () => {
      await quartz.transfer(vesting.address, 1000);
      await vesting.addClaimable(alice.address, 1000);

      await time.increase(start);
      await vesting.claim(alice.address);

      expect(await vesting.currentlyClaimable(alice.address)).to.equal(0);

      const newTime = (await getCurrentTime()).add(1);
      await vesting.changeBatches(newTime, 300, 300, 300);

      time.increase(1);
      expect(await vesting.currentlyClaimable(alice.address)).to.equal(200);

      time.increase(300);
      expect(await vesting.currentlyClaimable(alice.address)).to.equal(500);
    });
  });

  describe('claim', () => {
    it('allows a beneficiary to claim the corresponding amount', async () => {
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
