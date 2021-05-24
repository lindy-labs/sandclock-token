const { ethers } = require('hardhat');
const { expect } = require('chai');
const { BigNumber } = require('ethers');
const { time, constants } = require('@openzeppelin/test-helpers');
const { getCurrentTime, getCurrentBlock } = require('./utils');

describe('Quartz', () => {
  let accounts;
  let quartz;
  let owner;
  let governor = '0xe813FED5dAE6B9DBf29671bF09F8Ae998c42768D';
  let decimalsUnit = BigNumber.from('10').pow(new BigNumber.from('18'));
  let totalSupply = BigNumber.from('100000000').mul(decimalsUnit);
  const name = 'Sandclock';
  const symbol = 'QUARTZ';
  const decimals = 18;

  beforeEach(async () => {
    accounts = await ethers.getSigners();
    owner = accounts[0];

    const Quartz = await ethers.getContractFactory('Quartz');
    quartz = await Quartz.deploy(totalSupply);
  });

  describe('Quartz tokenomics', () => {
    it('Check name', async () => {
      expect(await quartz.name()).equal(name);
    });

    it('Check symbol', async () => {
      expect(await quartz.symbol()).equal(symbol);
    });

    it('Check decimals', async () => {
      expect(await quartz.decimals()).equal(decimals);
    });

    it('Check total supply', async () => {
      expect(await quartz.totalSupply()).equal(totalSupply);
    });

    it('Check owner', async () => {
      expect(await quartz.owner()).equal(owner.address);
    });

    it('Check owner balance', async () => {
      expect(await quartz.balanceOf(owner.address)).equal(totalSupply);
    });

    it('Check governor', async () => {
      expect(await quartz.governor()).equal(constants.ZERO_ADDRESS);
    });

    it('Check stake length', async () => {
      expect(await quartz.stakeLength()).equal('0');
    });

    it('Check total staked', async () => {
      expect(await quartz.totalStaked()).equal('0');
    });
  });

  describe('setGovernor', () => {
    it('Revert to set governor by non-owner', async () => {
      await expect(
        quartz.connect(accounts[1]).setGovernor(governor),
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('Revert to set zero address as governor', async () => {
      await expect(
        quartz.connect(owner).setGovernor(constants.ZERO_ADDRESS),
      ).to.be.revertedWith('QUARTZ: Governor cannot be zero');
    });

    it('Should set governor by owner', async () => {
      expect(await quartz.governor()).to.equal(constants.ZERO_ADDRESS);
      await quartz.connect(owner).setGovernor(governor);
      expect(await quartz.governor()).to.equal(governor);
    });
  });

  describe('stake', () => {
    const amount = BigNumber.from('1000').mul(decimalsUnit);
    const period = BigNumber.from('3600');
    let sender;
    let beneficiary;

    beforeEach(async () => {
      sender = accounts[1];
      beneficiary = accounts[2];
      await quartz.connect(owner).transfer(sender.address, totalSupply);
    });

    it('Revert to stake for zero address', async () => {
      await expect(
        quartz.connect(sender).stake(amount, constants.ZERO_ADDRESS, period),
      ).to.be.revertedWith('QUARTZ: Beneficiary cannot be 0x0');
    });

    it('Revert to stake zero amount', async () => {
      await expect(
        quartz.connect(sender).stake('0', beneficiary.address, period),
      ).to.be.revertedWith('QUARTZ: Amount must be greater than zero');
    });

    it('Revert to stake when sender has no balance', async () => {
      await expect(
        quartz.connect(accounts[3]).stake(amount, beneficiary.address, period),
      ).to.be.revertedWith('ERC20: transfer amount exceeds balance');
    });

    it('Stake for single beneficiary', async () => {
      expect(await quartz.delegates(beneficiary.address)).equal(
        constants.ZERO_ADDRESS,
      );
      expect(await quartz.numCheckpoints(beneficiary.address)).equal(0);
      const tx = await quartz
        .connect(sender)
        .stake(amount, beneficiary.address, period);
      const currentTime = await getCurrentTime();
      const currentBlock = await getCurrentBlock();
      expect(tx)
        .to.emit(quartz, 'Staked')
        .withArgs(
          '0',
          sender.address,
          beneficiary.address,
          amount,
          currentTime.add(period),
        );
      expect(await quartz.balanceOf(quartz.address)).equal(amount);
      expect(await quartz.balanceOf(sender.address)).equal(
        totalSupply.sub(amount),
      );
      expect(await quartz.totalStaked()).equal(amount);
      expect(await quartz.stakeLength()).equal('1');
      expect(await quartz.getOwnerStakeIdsLength(sender.address)).equal('1');
      expect(await quartz.getBeneficiaryIdsLength(sender.address)).equal('0');
      expect(await quartz.getOwnerStakeIdsLength(beneficiary.address)).equal(
        '0',
      );
      expect(await quartz.getBeneficiaryIdsLength(beneficiary.address)).equal(
        '1',
      );
      const stakeInfo = await quartz.stakes(0);
      expect(stakeInfo.owner).equal(sender.address);
      expect(stakeInfo.beneficiary).equal(beneficiary.address);
      expect(stakeInfo.amount).equal(amount);
      expect(stakeInfo.period).equal(period);
      expect(stakeInfo.maturationTimestamp).equal(currentTime.add(period));
      expect(stakeInfo.active).equal(true);

      expect(tx)
        .to.emit(quartz, 'DelegateChanged')
        .withArgs(
          beneficiary.address,
          constants.ZERO_ADDRESS,
          beneficiary.address,
        );
      expect(tx)
        .to.emit(quartz, 'DelegateVotesChanged')
        .withArgs(beneficiary.address, '0', amount);
      expect(await quartz.userVotesRep(beneficiary.address)).equal(amount);
      expect(await quartz.delegates(beneficiary.address)).equal(
        beneficiary.address,
      );
      const checkpoints = await quartz.checkpoints(beneficiary.address, '0');
      expect(checkpoints.fromBlock).equal(currentBlock);
      expect(checkpoints.votes).equal(amount);
      expect(await quartz.numCheckpoints(beneficiary.address)).equal(1);
      await time.advanceBlock();
      await time.advanceBlock();
      await time.advanceBlock();
      expect(
        await quartz.getPriorVotes(
          beneficiary.address,
          currentBlock.sub(BigNumber.from('1')),
        ),
      ).equal('0');
      expect(
        await quartz.getPriorVotes(beneficiary.address, currentBlock),
      ).equal(amount);
      expect(
        await quartz.getPriorVotes(
          beneficiary.address,
          currentBlock.add(BigNumber.from('1')),
        ),
      ).equal(amount);
    });

    it('Stake for single beneficiary 2 times', async () => {
      let amount2 = BigNumber.from('100').mul(decimalsUnit);
      let period2 = BigNumber.from('360');
      let waitTime = BigNumber.from('100');
      let tx = await quartz
        .connect(sender)
        .stake(amount, beneficiary.address, period);
      const currentTime = await getCurrentTime();
      const currentBlock = await getCurrentBlock();

      await time.increase(waitTime.toString());
      tx = await quartz
        .connect(sender)
        .stake(amount2, beneficiary.address, period2);

      const currentTime2 = await getCurrentTime();
      const currentBlock2 = await getCurrentBlock();
      expect(tx)
        .to.emit(quartz, 'Staked')
        .withArgs(
          '1',
          sender.address,
          beneficiary.address,
          amount2,
          currentTime2.add(period2),
        );
      expect(await quartz.balanceOf(quartz.address)).equal(amount.add(amount2));
      expect(await quartz.balanceOf(sender.address)).equal(
        totalSupply.sub(amount).sub(amount2),
      );
      expect(await quartz.totalStaked()).equal(amount.add(amount2));
      expect(await quartz.stakeLength()).equal('2');
      expect(await quartz.getOwnerStakeIdsLength(sender.address)).equal('2');
      expect(await quartz.getBeneficiaryIdsLength(sender.address)).equal('0');
      expect(await quartz.getOwnerStakeIdsLength(beneficiary.address)).equal(
        '0',
      );
      expect(await quartz.getBeneficiaryIdsLength(beneficiary.address)).equal(
        '2',
      );
      const stakeInfo = await quartz.stakes(1);
      expect(stakeInfo.owner).equal(sender.address);
      expect(stakeInfo.beneficiary).equal(beneficiary.address);
      expect(stakeInfo.amount).equal(amount2);
      expect(stakeInfo.period).equal(period2);
      expect(stakeInfo.maturationTimestamp).equal(currentTime2.add(period2));
      expect(stakeInfo.active).equal(true);

      expect(tx)
        .to.emit(quartz, 'DelegateVotesChanged')
        .withArgs(beneficiary.address, amount, amount.add(amount2));
      expect(await quartz.userVotesRep(beneficiary.address)).equal(
        amount.add(amount2),
      );
      expect(await quartz.delegates(beneficiary.address)).equal(
        beneficiary.address,
      );
      const checkpoints = await quartz.checkpoints(beneficiary.address, '0');
      expect(checkpoints.fromBlock).equal(currentBlock);
      expect(checkpoints.votes).equal(amount);
      const checkpoints2 = await quartz.checkpoints(beneficiary.address, '1');
      expect(checkpoints2.fromBlock).equal(currentBlock2);
      expect(checkpoints2.votes).equal(amount.add(amount2));
      expect(await quartz.numCheckpoints(beneficiary.address)).equal(2);
      await time.advanceBlock();
      await time.advanceBlock();
      await time.advanceBlock();
      expect(
        await quartz.getPriorVotes(beneficiary.address, currentBlock.sub('1')),
      ).equal('0');
      expect(
        await quartz.getPriorVotes(beneficiary.address, currentBlock.add('1')),
      ).equal(amount);
      expect(
        await quartz.getPriorVotes(beneficiary.address, currentBlock2),
      ).equal(amount.add(amount2));
    });

    it('Stake for two beneficiaries', async () => {
      let amount2 = BigNumber.from('100').mul(decimalsUnit);
      let period2 = BigNumber.from('360');
      let beneficiary2 = accounts[4];
      let waitTime = BigNumber.from('100');
      let tx = await quartz
        .connect(sender)
        .stake(amount, beneficiary.address, period);
      const currentTime = await getCurrentTime();
      const currentBlock = await getCurrentBlock();

      await time.increase(waitTime.toString());
      let tx2 = await quartz
        .connect(sender)
        .stake(amount2, beneficiary2.address, period2);

      const currentTime2 = await getCurrentTime();
      const currentBlock2 = await getCurrentBlock();
      expect(tx2)
        .to.emit(quartz, 'Staked')
        .withArgs(
          '1',
          sender.address,
          beneficiary2.address,
          amount2,
          currentTime2.add(period2),
        );
      expect(await quartz.balanceOf(quartz.address)).equal(amount.add(amount2));
      expect(await quartz.balanceOf(sender.address)).equal(
        totalSupply.sub(amount).sub(amount2),
      );
      expect(await quartz.totalStaked()).equal(amount.add(amount2));
      expect(await quartz.stakeLength()).equal('2');
      expect(await quartz.getOwnerStakeIdsLength(sender.address)).equal('2');
      expect(await quartz.getBeneficiaryIdsLength(sender.address)).equal('0');
      expect(await quartz.getOwnerStakeIdsLength(beneficiary.address)).equal(
        '0',
      );
      expect(await quartz.getBeneficiaryIdsLength(beneficiary.address)).equal(
        '1',
      );
      expect(await quartz.getBeneficiaryIdsLength(beneficiary2.address)).equal(
        '1',
      );
      let stakeInfo = await quartz.stakes(0);
      expect(stakeInfo.owner).equal(sender.address);
      expect(stakeInfo.beneficiary).equal(beneficiary.address);
      expect(stakeInfo.amount).equal(amount);
      expect(stakeInfo.period).equal(period);
      expect(stakeInfo.maturationTimestamp).equal(currentTime.add(period));
      expect(stakeInfo.active).equal(true);

      stakeInfo = await quartz.stakes(1);
      expect(stakeInfo.owner).equal(sender.address);
      expect(stakeInfo.beneficiary).equal(beneficiary2.address);
      expect(stakeInfo.amount).equal(amount2);
      expect(stakeInfo.period).equal(period2);
      expect(stakeInfo.maturationTimestamp).equal(currentTime2.add(period2));
      expect(stakeInfo.active).equal(true);

      expect(tx2)
        .to.emit(quartz, 'DelegateVotesChanged')
        .withArgs(beneficiary2.address, '0', amount2);
      expect(await quartz.userVotesRep(beneficiary.address)).equal(amount);
      expect(await quartz.userVotesRep(beneficiary2.address)).equal(amount2);
      expect(await quartz.delegates(beneficiary.address)).equal(
        beneficiary.address,
      );
      expect(await quartz.delegates(beneficiary2.address)).equal(
        beneficiary2.address,
      );
      const checkpoints = await quartz.checkpoints(beneficiary.address, '0');
      expect(checkpoints.fromBlock).equal(currentBlock);
      expect(checkpoints.votes).equal(amount);
      const checkpoints2 = await quartz.checkpoints(beneficiary2.address, '0');
      expect(checkpoints2.fromBlock).equal(currentBlock2);
      expect(checkpoints2.votes).equal(amount2);
      expect(await quartz.numCheckpoints(beneficiary.address)).equal(1);
      expect(await quartz.numCheckpoints(beneficiary2.address)).equal(1);

      await time.advanceBlock();
      await time.advanceBlock();
      await time.advanceBlock();
      expect(
        await quartz.getPriorVotes(beneficiary.address, currentBlock.add('1')),
      ).equal(amount);
      expect(
        await quartz.getPriorVotes(beneficiary2.address, currentBlock.add('1')),
      ).equal('0');
      expect(
        await quartz.getPriorVotes(beneficiary.address, currentBlock2),
      ).equal(amount);
      expect(
        await quartz.getPriorVotes(beneficiary2.address, currentBlock2),
      ).equal(amount2);
    });

    it('Stake for it self', async () => {
      beneficiary = sender;
      expect(await quartz.delegates(beneficiary.address)).equal(
        constants.ZERO_ADDRESS,
      );
      expect(await quartz.numCheckpoints(beneficiary.address)).equal(0);
      const tx = await quartz
        .connect(sender)
        .stake(amount, beneficiary.address, period);
      const currentTime = await getCurrentTime();
      const currentBlock = await getCurrentBlock();
      expect(tx)
        .to.emit(quartz, 'Staked')
        .withArgs(
          '0',
          sender.address,
          beneficiary.address,
          amount,
          currentTime.add(period),
        );
      expect(await quartz.balanceOf(quartz.address)).equal(amount);
      expect(await quartz.balanceOf(sender.address)).equal(
        totalSupply.sub(amount),
      );
      expect(await quartz.totalStaked()).equal(amount);
      expect(await quartz.stakeLength()).equal('1');
      expect(await quartz.getOwnerStakeIdsLength(sender.address)).equal('1');
      expect(await quartz.getBeneficiaryIdsLength(sender.address)).equal('1');
      expect(await quartz.getOwnerStakeIdsLength(beneficiary.address)).equal(
        '1',
      );
      expect(await quartz.getBeneficiaryIdsLength(beneficiary.address)).equal(
        '1',
      );
      const stakeInfo = await quartz.stakes(0);
      expect(stakeInfo.owner).equal(sender.address);
      expect(stakeInfo.beneficiary).equal(beneficiary.address);
      expect(stakeInfo.amount).equal(amount);
      expect(stakeInfo.period).equal(period);
      expect(stakeInfo.maturationTimestamp).equal(currentTime.add(period));
      expect(stakeInfo.active).equal(true);

      expect(tx)
        .to.emit(quartz, 'DelegateChanged')
        .withArgs(
          beneficiary.address,
          constants.ZERO_ADDRESS,
          beneficiary.address,
        );
      expect(tx)
        .to.emit(quartz, 'DelegateVotesChanged')
        .withArgs(beneficiary.address, '0', amount);
      expect(await quartz.userVotesRep(beneficiary.address)).equal(amount);
      expect(await quartz.delegates(beneficiary.address)).equal(
        beneficiary.address,
      );
      const checkpoints = await quartz.checkpoints(beneficiary.address, '0');
      expect(checkpoints.fromBlock).equal(currentBlock);
      expect(checkpoints.votes).equal(amount);
      expect(await quartz.numCheckpoints(beneficiary.address)).equal(1);
      await time.advanceBlock();
      await time.advanceBlock();
      await time.advanceBlock();
      expect(
        await quartz.getPriorVotes(
          beneficiary.address,
          currentBlock.sub(BigNumber.from('1')),
        ),
      ).equal('0');
      expect(
        await quartz.getPriorVotes(beneficiary.address, currentBlock),
      ).equal(amount);
      expect(
        await quartz.getPriorVotes(
          beneficiary.address,
          currentBlock.add(BigNumber.from('1')),
        ),
      ).equal(amount);
    });

    it('Stake for beneficiary who has delegatee', async () => {
      const delegatee = accounts[5];
      await quartz.connect(beneficiary).delegate(delegatee.address);
      expect(await quartz.delegates(beneficiary.address)).equal(
        delegatee.address,
      );
      expect(await quartz.numCheckpoints(beneficiary.address)).equal(0);
      const tx = await quartz
        .connect(sender)
        .stake(amount, beneficiary.address, period);
      const currentTime = await getCurrentTime();
      const currentBlock = await getCurrentBlock();
      expect(tx)
        .to.emit(quartz, 'Staked')
        .withArgs(
          '0',
          sender.address,
          beneficiary.address,
          amount,
          currentTime.add(period),
        );
      expect(await quartz.balanceOf(quartz.address)).equal(amount);
      expect(await quartz.balanceOf(sender.address)).equal(
        totalSupply.sub(amount),
      );
      expect(await quartz.totalStaked()).equal(amount);
      expect(await quartz.stakeLength()).equal('1');
      expect(await quartz.getOwnerStakeIdsLength(sender.address)).equal('1');
      expect(await quartz.getBeneficiaryIdsLength(sender.address)).equal('0');
      expect(await quartz.getOwnerStakeIdsLength(beneficiary.address)).equal(
        '0',
      );
      expect(await quartz.getBeneficiaryIdsLength(beneficiary.address)).equal(
        '1',
      );
      const stakeInfo = await quartz.stakes(0);
      expect(stakeInfo.owner).equal(sender.address);
      expect(stakeInfo.beneficiary).equal(beneficiary.address);
      expect(stakeInfo.amount).equal(amount);
      expect(stakeInfo.period).equal(period);
      expect(stakeInfo.maturationTimestamp).equal(currentTime.add(period));
      expect(stakeInfo.active).equal(true);

      expect(tx)
        .to.emit(quartz, 'DelegateVotesChanged')
        .withArgs(delegatee.address, '0', amount);
      expect(await quartz.userVotesRep(beneficiary.address)).equal(amount);
      expect(await quartz.delegates(beneficiary.address)).equal(
        delegatee.address,
      );
      const checkpoints = await quartz.checkpoints(delegatee.address, '0');
      expect(checkpoints.fromBlock).equal(currentBlock);
      expect(checkpoints.votes).equal(amount);
      expect(await quartz.numCheckpoints(delegatee.address)).equal(1);
      await time.advanceBlock();
      await time.advanceBlock();
      await time.advanceBlock();
      expect(
        await quartz.getPriorVotes(
          delegatee.address,
          currentBlock.sub(BigNumber.from('1')),
        ),
      ).equal('0');
      expect(await quartz.getPriorVotes(delegatee.address, currentBlock)).equal(
        amount,
      );
      expect(
        await quartz.getPriorVotes(
          delegatee.address,
          currentBlock.add(BigNumber.from('1')),
        ),
      ).equal(amount);
    });
  });

  describe('unstake', () => {
    const amount = BigNumber.from('1000').mul(decimalsUnit);
    const period = BigNumber.from('3600');
    let sender;
    let beneficiary;
    let currentTime;
    let currentBlock;

    beforeEach(async () => {
      sender = accounts[1];
      beneficiary = accounts[2];
      await quartz.connect(owner).transfer(sender.address, totalSupply);
      await quartz.connect(sender).stake(amount, beneficiary.address, period);
      currentTime = await getCurrentTime();
      currentBlock = await getCurrentBlock();
    });

    it('Revert to unstake invalid id', async () => {
      await expect(quartz.connect(sender).unstake('1')).to.be.revertedWith(
        'QUARTZ: Invalid id',
      );
    });

    it('Revert to unstake when not ready to unstake', async () => {
      await expect(quartz.connect(sender).unstake('0')).to.be.revertedWith(
        'QUARTZ: Not ready to unstake',
      );
    });

    it('Revert to unstake with non-owner', async () => {
      await time.increase(period.toString());
      await expect(quartz.connect(accounts[3]).unstake('0')).to.be.revertedWith(
        'QUARTZ: Not owner',
      );
    });

    it('Revert to unstake when not active', async () => {
      await time.increase(period.toString());
      await quartz.connect(sender).unstake('0');
      await expect(quartz.connect(sender).unstake('0')).to.be.revertedWith(
        'QUARTZ: Already unstaked',
      );
    });

    it('Unstake for single beneficiary', async () => {
      expect(await quartz.delegates(beneficiary.address)).equal(
        beneficiary.address,
      );
      expect(await quartz.numCheckpoints(beneficiary.address)).equal(1);
      await time.increase(period.toString());
      const tx = await quartz.connect(sender).unstake('0');
      const unstakedBlock = await getCurrentBlock();
      expect(tx)
        .to.emit(quartz, 'Unstaked')
        .withArgs('0', sender.address, beneficiary.address, amount);
      expect(await quartz.balanceOf(quartz.address)).equal('0');
      expect(await quartz.balanceOf(sender.address)).equal(totalSupply);
      expect(await quartz.totalStaked()).equal('0');
      expect(await quartz.stakeLength()).equal('1');
      expect(await quartz.getOwnerStakeIdsLength(sender.address)).equal('1');
      expect(await quartz.getBeneficiaryIdsLength(sender.address)).equal('0');
      expect(await quartz.getOwnerStakeIdsLength(beneficiary.address)).equal(
        '0',
      );
      expect(await quartz.getBeneficiaryIdsLength(beneficiary.address)).equal(
        '1',
      );
      const stakeInfo = await quartz.stakes(0);
      expect(stakeInfo.owner).equal(sender.address);
      expect(stakeInfo.beneficiary).equal(beneficiary.address);
      expect(stakeInfo.amount).equal(amount);
      expect(stakeInfo.active).equal(false);

      expect(tx)
        .to.emit(quartz, 'DelegateVotesChanged')
        .withArgs(beneficiary.address, amount, '0');
      expect(await quartz.userVotesRep(beneficiary.address)).equal('0');
      expect(await quartz.delegates(beneficiary.address)).equal(
        beneficiary.address,
      );
      let checkpoints = await quartz.checkpoints(beneficiary.address, '0');
      expect(checkpoints.fromBlock).equal(currentBlock);
      expect(checkpoints.votes).equal(amount);
      checkpoints = await quartz.checkpoints(beneficiary.address, '1');
      expect(checkpoints.fromBlock).equal(unstakedBlock);
      expect(checkpoints.votes).equal('0');
      expect(await quartz.numCheckpoints(beneficiary.address)).equal(2);
      await time.advanceBlock();
      await time.advanceBlock();
      await time.advanceBlock();
      expect(
        await quartz.getPriorVotes(
          beneficiary.address,
          currentBlock.sub(BigNumber.from('1')),
        ),
      ).equal('0');
      expect(
        await quartz.getPriorVotes(beneficiary.address, currentBlock),
      ).equal(amount);
      expect(
        await quartz.getPriorVotes(
          beneficiary.address,
          unstakedBlock.add(BigNumber.from('1')),
        ),
      ).equal('0');
    });
  });

  describe('delegates', () => {
    const stake = async (sender, beneficiary, amount, period) => {
      const tx = await quartz
        .connect(sender)
        .stake(amount, beneficiary.address, period);
      const currentTime = await getCurrentTime();
      const currentBlock = await getCurrentBlock();
      const stakeLength = BigNumber.from(await quartz.stakeLength());
      return {
        tx,
        currentTime,
        currentBlock,
        stakeLength,
      };
    };

    const unstake = async (sender, stakeId) => {
      const tx = await quartz.connect(sender).unstake(stakeId);
      const currentTime = await getCurrentTime();
      const currentBlock = await getCurrentBlock();
      return {
        tx,
        currentTime,
        currentBlock,
      };
    };

    beforeEach(async () => {
      for (let i = 0; i < 10; i += 1) {
        await quartz
          .connect(owner)
          .transfer(accounts[i].address, totalSupply.div(BigNumber.from('10')));
      }
    });

    it('delegate', async () => {
      const delegatee = accounts[5];
      let tx = await quartz.connect(accounts[2]).delegate(delegatee.address);
      expect(await quartz.delegates(accounts[2].address)).equal(
        delegatee.address,
      );
      expect(tx)
        .to.emit(quartz, 'DelegateChanged')
        .withArgs(
          accounts[2].address,
          constants.ZERO_ADDRESS,
          delegatee.address,
        );
      const newDelegatee = accounts[6];
      tx = await quartz.connect(accounts[2]).delegate(newDelegatee.address);
      expect(await quartz.delegates(accounts[2].address)).equal(
        newDelegatee.address,
      );
      expect(tx)
        .to.emit(quartz, 'DelegateChanged')
        .withArgs(accounts[2].address, delegatee.address, newDelegatee.address);
    });

    it('Cannot delegate to zero address', async () => {
      await expect(
        quartz.connect(accounts[2]).delegate(constants.ZERO_ADDRESS),
      ).to.be.revertedWith('QUARTZ: delegatee cannot be 0x0');
    });

    it('Move delegates', async () => {
      const sender = accounts[1];
      const beneficiary = accounts[2];
      const delegatee = accounts[3];
      const amount = BigNumber.from('1000').mul(decimalsUnit);
      const period = BigNumber.from('3600');
      const { tx, currentTime, currentBlock, stakeLength } = await stake(
        sender,
        beneficiary,
        amount,
        period,
      );
      expect(await quartz.getCurrentVotes(beneficiary.address)).equal(amount);
      const delegateTx = await quartz
        .connect(beneficiary)
        .delegate(delegatee.address);
      let delegateBlock = await getCurrentBlock();
      expect(delegateTx)
        .to.emit(quartz, 'DelegateChanged')
        .withArgs(beneficiary.address, beneficiary.address, delegatee.address);

      expect(await quartz.numCheckpoints(beneficiary.address)).equal(2);
      let checkpoints = await quartz.checkpoints(beneficiary.address, 0);
      expect(checkpoints.fromBlock).equal(currentBlock);
      expect(checkpoints.votes).equal(amount);
      checkpoints = await quartz.checkpoints(beneficiary.address, 1);
      expect(checkpoints.fromBlock).equal(delegateBlock);
      expect(checkpoints.votes).equal('0');
      checkpoints = await quartz.checkpoints(delegatee.address, 0);
      expect(checkpoints.fromBlock).equal(delegateBlock);
      expect(checkpoints.votes).equal(amount);
      expect(await quartz.numCheckpoints(delegatee.address)).equal(1);
      await time.advanceBlock();
      expect(
        await quartz.getPriorVotes(beneficiary.address, currentBlock),
      ).equal(amount);
      expect(
        await quartz.getPriorVotes(beneficiary.address, delegateBlock),
      ).equal('0');
      expect(await quartz.getPriorVotes(delegatee.address, currentBlock)).equal(
        '0',
      );
      expect(
        await quartz.getPriorVotes(delegatee.address, delegateBlock),
      ).equal(amount);
      expect(await quartz.getCurrentVotes(beneficiary.address)).equal(0);
      expect(await quartz.getCurrentVotes(delegatee.address)).equal(amount);
    });

    it('Unstake after delegate changed', async () => {
      const sender = accounts[1];
      const beneficiary = accounts[2];
      const delegatee = accounts[3];
      const amount = BigNumber.from('1000').mul(decimalsUnit);
      const period = BigNumber.from('3600');
      await stake(sender, beneficiary, amount, period);
      expect(await quartz.getCurrentVotes(beneficiary.address)).equal(amount);
      await quartz.connect(beneficiary).delegate(delegatee.address);
      await time.increase(period.toString());
      let delegateBlock = await getCurrentBlock();

      let { tx, currentTime, currentBlock } = await unstake(sender, '0');

      expect(await quartz.numCheckpoints(delegatee.address)).equal(2);
      let checkpoints = await quartz.checkpoints(delegatee.address, 1);
      expect(checkpoints.fromBlock).equal(currentBlock);
      expect(checkpoints.votes).equal('0');
      expect(await quartz.numCheckpoints(delegatee.address)).equal(2);
      await time.advanceBlock();
      expect(
        await quartz.getPriorVotes(delegatee.address, delegateBlock),
      ).equal(amount);
      expect(await quartz.getPriorVotes(delegatee.address, currentBlock)).equal(
        '0',
      );
      expect(await quartz.getCurrentVotes(beneficiary.address)).equal(0);
      expect(await quartz.getCurrentVotes(delegatee.address)).equal(0);
    });
  });
});

describe('QuartzL1', () => {
  let accounts;
  let quartz;
  let owner;
  let decimalsUnit = BigNumber.from('10').pow(new BigNumber.from('18'));
  let totalSupply = BigNumber.from('100000000').mul(decimalsUnit);
  const name = 'Sandclock';
  const symbol = 'QUARTZ';
  const decimals = 18;

  beforeEach(async () => {
    accounts = await ethers.getSigners();
    owner = accounts[0];

    const Quartz = await ethers.getContractFactory('QuartzL1');
    quartz = await Quartz.deploy(totalSupply);
  });

  describe('Quartz tokenomics', () => {
    it('Check name', async () => {
      expect(await quartz.name()).equal(name);
    });

    it('Check symbol', async () => {
      expect(await quartz.symbol()).equal(symbol);
    });

    it('Check decimals', async () => {
      expect(await quartz.decimals()).equal(decimals);
    });

    it('Check total supply', async () => {
      expect(await quartz.totalSupply()).equal(totalSupply);
    });

    it('Check owner balance', async () => {
      expect(await quartz.balanceOf(owner.address)).equal(totalSupply);
    });
  });
});
