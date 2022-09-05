const { ethers } = require('hardhat');
const { expect } = require('chai');
const { BigNumber, constants, utils } = require('ethers');
const { time } = require('@openzeppelin/test-helpers');
const { getCurrentTime } = require('./utils');

describe('LinearVesting', () => {
  let vesting;
  let quartz;
  let deployer;
  let alice;
  let bob;

  beforeEach(async () => {
    [deployer, alice, bob, carol] = await ethers.getSigners();

    const Quartz = await ethers.getContractFactory('QuartzToken');
    quartz = await Quartz.deploy();

    const LinearVesting = await ethers.getContractFactory('LinearVesting');
    vesting = await LinearVesting.deploy(quartz.address);
  });

  describe('constructor', () => {
    it('revert if token is address(0)', async () => {
      const LinearVesting = await ethers.getContractFactory('LinearVesting');

      await expect(
        LinearVesting.deploy(constants.AddressZero),
      ).to.be.revertedWith('token is 0x');
    });

    it('check initial values', async () => {
      expect(await vesting.token()).to.be.equal(quartz.address);
    });
  });

  describe('addVesting', () => {
    let startTime;
    let period = 86400 * 365;
    let amount = utils.parseEther('5000');

    beforeEach(async () => {
      startTime = BigNumber.from(await getCurrentTime()).add(
        BigNumber.from('100'),
      );
    });

    it('revert if amount is zero', async () => {
      await expect(
        vesting.addVesting(alice.address, startTime, period, 0),
      ).to.be.revertedWith('amount is 0');
    });

    it('revert if period is zero', async () => {
      await expect(
        vesting.addVesting(alice.address, startTime, 0, amount),
      ).to.be.revertedWith('period is 0');
    });

    it('revert if startTime is 0', async () => {
      await expect(
        vesting.addVesting(alice.address, 0, period, amount),
      ).to.be.revertedWith('startTime is 0');
    });

    it('revert if beneficiary is address(0)', async () => {
      await expect(
        vesting.addVesting(constants.AddressZero, startTime, period, amount),
      ).to.be.revertedWith('beneficiary is 0x');
    });

    it('should add new vesting info', async () => {
      await quartz.transfer(alice.address, amount);
      await quartz.connect(alice).approve(vesting.address, amount);

      const tx = await vesting
        .connect(alice)
        .addVesting(bob.address, startTime, period, amount);

      await expect(tx)
        .to.emit(vesting, 'VestingAdded')
        .withArgs(bob.address, startTime, period, amount);

      const vestingInfo = await vesting.vestings(bob.address);
      expect(vestingInfo.startTime).to.be.equal(startTime);
      expect(vestingInfo.period).to.be.equal(period);
      expect(vestingInfo.amount).to.be.equal(amount);

      expect(await quartz.balanceOf(vesting.address)).to.be.equal(amount);
      expect(await quartz.balanceOf(alice.address)).to.be.equal('0');
    });

    it('revert to add if vesting already exist for beneficiary', async () => {
      await quartz.transfer(alice.address, amount);
      await quartz.connect(alice).approve(vesting.address, amount);

      await vesting
        .connect(alice)
        .addVesting(bob.address, startTime, period, amount);

      await expect(
        vesting.addVesting(bob.address, startTime, period, amount),
      ).to.be.revertedWith('vesting exist');
    });

    it('should add new vesting if previous vesting ends.', async () => {
      await quartz.transfer(alice.address, amount);
      await quartz.connect(alice).approve(vesting.address, amount);

      await vesting
        .connect(alice)
        .addVesting(bob.address, startTime, period, amount);

      await time.increase(period + 1000);
      await vesting.connect(bob).claim();

      const newAmount = utils.parseEther('1000');
      await quartz.connect(deployer).approve(vesting.address, newAmount);

      startTime = (await getCurrentTime()).add(BigNumber.from('100'));

      const tx = await vesting.addVesting(
        bob.address,
        startTime,
        period,
        newAmount,
      );

      await expect(tx)
        .to.emit(vesting, 'VestingAdded')
        .withArgs(bob.address, startTime, period, newAmount);

      const vestingInfo = await vesting.vestings(bob.address);
      expect(vestingInfo.startTime).to.be.equal(startTime);
      expect(vestingInfo.period).to.be.equal(period);
      expect(vestingInfo.amount).to.be.equal(newAmount);

      expect(await quartz.balanceOf(vesting.address)).to.be.equal(newAmount);
    });
  });

  describe('getPendingAmount', () => {
    let startTime;
    let period = 86400 * 365;
    let amount = utils.parseEther('5000');

    beforeEach(async () => {
      await quartz.transfer(alice.address, amount);
      await quartz.connect(alice).approve(vesting.address, amount);

      startTime = (await getCurrentTime()).add(BigNumber.from('100'));

      await vesting
        .connect(alice)
        .addVesting(bob.address, startTime, period, amount);
    });

    it('return zero before start', async () => {
      expect(await vesting.getPendingAmount(bob.address)).to.equal(0);
    });

    it('return zero if no vesting exist', async () => {
      expect(await vesting.getPendingAmount(alice.address)).to.equal(0);
    });

    it('return correct pending amount after vesting starts', async () => {
      const timeElapsed = BigNumber.from('86400');

      await time.increaseTo(startTime.add(timeElapsed).toString());

      const pendingAmount = amount.mul(timeElapsed).div(period);

      expect(await vesting.getPendingAmount(bob.address)).to.be.equal(
        pendingAmount,
      );
    });

    it('return zero after claim', async () => {
      const timeElapsed = BigNumber.from('86400');

      await time.increaseTo(startTime.add(timeElapsed).toString());

      await vesting.connect(bob).claim();

      expect(await vesting.getPendingAmount(bob.address)).to.be.equal(0);
    });

    it('subtract claimed amount', async () => {
      const timeElapsed1 = BigNumber.from('86400');

      await time.increaseTo(startTime.add(timeElapsed1).toString());

      await vesting.connect(bob).claim();

      const claimedAmount = amount
        .mul(timeElapsed1.add(BigNumber.from('1')))
        .div(period);

      const timeElapsed2 = BigNumber.from('864000');

      await time.increaseTo(
        startTime
          .add(timeElapsed1)
          .add(timeElapsed2)
          .add(BigNumber.from('1'))
          .toString(),
      );

      const totalAmount = amount
        .mul(timeElapsed1.add(timeElapsed2).add(BigNumber.from('1')))
        .div(period);

      expect(await vesting.getPendingAmount(bob.address)).to.be.equal(
        totalAmount.sub(claimedAmount),
      );
    });

    it('return full amount if vesting ends', async () => {
      await time.increaseTo(
        startTime.add(period).add(BigNumber.from('100')).toString(),
      );

      expect(await vesting.getPendingAmount(bob.address)).to.be.equal(amount);
    });
  });

  describe('claim', () => {
    let startTime;
    let period = 86400 * 365;
    let amount = utils.parseEther('5000');

    beforeEach(async () => {
      await quartz.transfer(alice.address, amount);
      await quartz.connect(alice).approve(vesting.address, amount);

      startTime = BigNumber.from(await getCurrentTime()).add(
        BigNumber.from('100'),
      );

      await vesting
        .connect(alice)
        .addVesting(bob.address, startTime, period, amount);
    });

    it('revert if no pending amount', async () => {
      await expect(vesting.connect(bob).claim()).to.be.revertedWith(
        'nothing to claim',
      );
    });

    it('claim pending amount', async () => {
      const timeElapsed = BigNumber.from('86400');

      await time.increaseTo(startTime.add(timeElapsed).toString());

      const tx = await vesting.connect(bob).claim();

      const claimedAmount = amount
        .mul(timeElapsed.add(BigNumber.from('1')))
        .div(period);

      await expect(tx)
        .to.emit(vesting, 'Claimed')
        .withArgs(bob.address, claimedAmount);

      expect(await quartz.balanceOf(bob.address)).to.be.equal(claimedAmount);
      expect(await quartz.balanceOf(vesting.address)).to.be.equal(
        amount.sub(claimedAmount),
      );

      const vestingInfo = await vesting.vestings(bob.address);
      expect(vestingInfo.startTime).to.be.equal(startTime);
      expect(vestingInfo.period).to.be.equal(period);
      expect(vestingInfo.amount).to.be.equal(amount);
      expect(vestingInfo.claimed).to.be.equal(claimedAmount);
    });

    it('claim full balance after vesting ends', async () => {
      await time.increase(period + 1000);

      const tx = await vesting.connect(bob).claim();

      await expect(tx)
        .to.emit(vesting, 'Claimed')
        .withArgs(bob.address, amount);

      expect(await quartz.balanceOf(bob.address)).to.be.equal(amount);
      expect(await quartz.balanceOf(vesting.address)).to.be.equal(0);

      const vestingInfo = await vesting.vestings(bob.address);
      expect(vestingInfo.startTime).to.be.equal(startTime);
      expect(vestingInfo.period).to.be.equal(period);
      expect(vestingInfo.amount).to.be.equal(amount);
      expect(vestingInfo.claimed).to.be.equal(amount);
    });
  });

  describe.only('subvisual vesting scenario', () => {
    let startTime = BigNumber.from('1635199200'); // October 26, 2021
    let period = 86400 * 365 * 2; // 2 years
    let amounts = [utils.parseEther('50000'), utils.parseEther('20000')];

    beforeEach(async () => {
      await quartz.transfer(alice.address, amounts[0].add(amounts[1]));

      await quartz
        .connect(alice)
        .approve(vesting.address, amounts[0].add(amounts[1]));

      await vesting
        .connect(alice)
        .addVesting(bob.address, startTime, period, amounts[0]);

      await vesting
        .connect(alice)
        .addVesting(carol.address, startTime, period, amounts[1]);
    });

    it('claim pending amount after 1 year', async () => {
      const year = BigNumber.from('86400').mul(BigNumber.from('365'));
      const now = BigNumber.from((await ethers.provider.getBlock()).timestamp);
      const timeElapsed = (now.sub(startTime)).add(year);

      await time.increaseTo(startTime.add(timeElapsed).toString());

      await vesting.connect(bob).claim();

      await vesting.connect(carol).claim();

      let claimedAmounts = [
        amounts[0].mul(timeElapsed.add(BigNumber.from('1'))).div(period),
        amounts[1].mul(timeElapsed.add(BigNumber.from('1'))).div(period),
      ];

      expect(await quartz.balanceOf(bob.address)).to.be.equal(
        claimedAmounts[0],
      );

      expect(await quartz.balanceOf(carol.address)).to.be.equal(
        claimedAmounts[1],
      );
    });

    it('cannot claim full amount after 1.5 years', async () => {
      const year = BigNumber.from('86400').mul(BigNumber.from('365'));
      const now = BigNumber.from((await ethers.provider.getBlock()).timestamp);
      const timeElapsed = (now.sub(startTime)).add(BigNumber.from('182'));
      await time.increaseTo(startTime.add(timeElapsed).toString());

      await vesting.connect(bob).claim();
      await vesting.connect(carol).claim();

      expect(await quartz.balanceOf(bob.address)).to.be.lt(amounts[0]);

      expect(await quartz.balanceOf(carol.address)).to.be.lt(amounts[1]);
    });

    it('claim full balance after vesting ends', async () => {
      // advance 2 years
      const timeElapsed = BigNumber.from('86400')
        .mul(BigNumber.from('365'))
        .mul(BigNumber.from('2'));
      await time.increaseTo(startTime.add(timeElapsed).toString());

      const tx = await vesting.connect(bob).claim();

      const tx1 = await vesting.connect(carol).claim();

      await expect(tx)
        .to.emit(vesting, 'Claimed')
        .withArgs(bob.address, amounts[0]);

      await expect(tx1)
        .to.emit(vesting, 'Claimed')
        .withArgs(carol.address, amounts[1]);

      expect(await quartz.balanceOf(bob.address)).to.be.equal(amounts[0]);

      expect(await quartz.balanceOf(carol.address)).to.be.equal(amounts[1]);
    });
  });
});
