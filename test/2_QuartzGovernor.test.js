const { ethers, upgrades } = require('hardhat');
const { expect } = require('chai');
const { BigNumber } = require('ethers');
const { utils } = require('ethers');
const { time, constants } = require('@openzeppelin/test-helpers');
const { getCurrentBlock, getCurrentTime } = require('./utils');

describe('QuartzGovernor', () => {
  let accounts;
  let quartz;
  let owner;
  let governor;
  let proposalSubmitter;
  let decimalsUnit = BigNumber.from('10').pow(new BigNumber.from('18'));
  let totalSupply = BigNumber.from('100000000').mul(decimalsUnit);
  let decay = BigNumber.from('9999799');
  let maxRatio = BigNumber.from('1000000');
  let weight = BigNumber.from('2500');
  let minThresholdStakePercentage = BigNumber.from('5');
  let minVotesToPass = BigNumber.from('10000000000000000000');
  let updateSettingsRole;
  let cancelProposalsRole;
  let proposalThreshold = totalSupply.div(BigNumber.from('1000')); // 0.1% of total supply
  let proposalActivePeriod = 2592000;

  beforeEach(async () => {
    accounts = await ethers.getSigners();
    updateSettingsRole = accounts[0];
    owner = accounts[0];
    proposalSubmitter = accounts[3];
    cancelProposalsRole = accounts[4];
    const Quartz = await ethers.getContractFactory('Quartz');
    quartz = await upgrades.deployProxy(Quartz, [0, owner.address]);

    const depositData = utils.defaultAbiCoder.encode(
      ['uint256'],
      [totalSupply],
    );
    await quartz.connect(owner).deposit(owner.address, depositData);
    const QuartzGovernor = await ethers.getContractFactory('QuartzGovernor');
    governor = await upgrades.deployProxy(QuartzGovernor, [
      quartz.address,
      decay,
      maxRatio,
      weight,
      minThresholdStakePercentage,
      minVotesToPass,
      proposalThreshold,
      proposalActivePeriod,
    ]);
    await quartz.setGovernor(governor.address);
    await governor.grantRole(
      utils.keccak256(utils.toUtf8Bytes('UPDATE_SETTINGS_ROLE')),
      updateSettingsRole.address,
    );
    await governor.grantRole(
      utils.keccak256(utils.toUtf8Bytes('CANCEL_PROPOSAL_ROLE')),
      cancelProposalsRole.address,
    );
  });

  describe('Quartz governor init values', () => {
    it('Check QUARTZ token', async () => {
      expect(await governor.quartz()).equal(quartz.address);
    });

    it('Check decay', async () => {
      expect(await governor.decay()).equal(decay);
    });

    it('Check maxRatio', async () => {
      expect(await governor.maxRatio()).equal(maxRatio);
    });

    it('Check weight', async () => {
      expect(await governor.weight()).equal(weight);
    });

    it('Check minThresholdStakePercentage', async () => {
      expect(await governor.minThresholdStakePercentage()).equal(
        minThresholdStakePercentage,
      );
    });

    it('Check minVotesToPass', async () => {
      expect(await governor.minVotesToPass()).equal(minVotesToPass);
    });

    it('Check proposalThreshold', async () => {
      expect(await governor.proposalThreshold()).equal(proposalThreshold);
    });

    it('Check proposalActivePeriod', async () => {
      expect(await governor.proposalActivePeriod()).equal(proposalActivePeriod);
    });

    it('Check proposalCounter', async () => {
      expect(await governor.proposalCounter()).equal('2');
    });

    it('Check lastVoteId', async () => {
      expect(await governor.lastVoteId()).equal('2');
    });

    it('Check ABSTAIN_PROPOSAL', async () => {
      const proposal = await governor.getProposal('1');
      expect(proposal.proposalStatus).equal(1);
      expect(proposal.submitter).equal(constants.ZERO_ADDRESS);
      expect(proposal.staked).equal(0);
      expect(proposal.expiration).equal(0);
      const positiveVotes = proposal.positiveVotes;
      const negativeVotes = proposal.negativeVotes;
      expect(positiveVotes.id).equal(1);
      expect(positiveVotes.totalVotes).equal(0);
      expect(positiveVotes.convictionLast).equal(0);
      expect(positiveVotes.blockLast).equal(0);
      expect(negativeVotes.id).equal(2);
      expect(negativeVotes.totalVotes).equal(0);
      expect(negativeVotes.convictionLast).equal(0);
      expect(negativeVotes.blockLast).equal(0);
    });
  });

  describe('setConvictionCalculationSettings', () => {
    it('Revert to update settings without role', async () => {
      await expect(
        governor
          .connect(accounts[1])
          .setConvictionCalculationSettings(1, 1, 1, 1, 1, 1, 1),
      ).to.be.revertedWith('QG_AUTH_FAILED');
    });

    it('Revert to update settings if minVotesToPass is zero', async () => {
      await expect(
        governor
          .connect(updateSettingsRole)
          .setConvictionCalculationSettings(1, 1, 1, 1, 0, 1, 1),
      ).to.be.revertedWith('QG_MIN_VOTES_TO_PASS_CAN_NOT_BE_ZERO');
    });

    it('Revert to update settings if proposalThreshold is zero', async () => {
      await expect(
        governor
          .connect(updateSettingsRole)
          .setConvictionCalculationSettings(1, 1, 1, 1, 1, 0, 1),
      ).to.be.revertedWith('QG_PROPOSAL_THRESHOLD_CAN_NOT_BE_ZERO');
    });

    it('Revert to update settings if proposalActivePeriod is zero', async () => {
      await expect(
        governor
          .connect(updateSettingsRole)
          .setConvictionCalculationSettings(1, 1, 1, 1, 1, 1, 0),
      ).to.be.revertedWith('QG_PROPOSAL_ACTIVE_PERIOD_CAN_NOT_BE_ZERO');
    });

    it('Should update settings', async () => {
      let newDecay = BigNumber.from('7');
      let newMaxRatio = BigNumber.from('8');
      let newWeight = BigNumber.from('9');
      let newMinThresholdStakePercentage = BigNumber.from('10');
      let newMinVotesToPass = BigNumber.from('11');
      let newProposalThreshold = totalSupply.div(BigNumber.from('10000'));
      let newProposalActivePeriod = 25920000;
      const tx = await governor
        .connect(updateSettingsRole)
        .setConvictionCalculationSettings(
          newDecay,
          newMaxRatio,
          newWeight,
          newMinThresholdStakePercentage,
          newMinVotesToPass,
          newProposalThreshold,
          newProposalActivePeriod,
        );
      await expect(tx)
        .to.emit(governor, 'ConvictionSettingsChanged')
        .withArgs(
          newDecay,
          newMaxRatio,
          newWeight,
          newMinThresholdStakePercentage,
          newMinVotesToPass,
          newProposalThreshold,
          newProposalActivePeriod,
        );
      expect(await governor.decay()).equal(newDecay);
      expect(await governor.maxRatio()).equal(newMaxRatio);
      expect(await governor.weight()).equal(newWeight);
      expect(await governor.minThresholdStakePercentage()).equal(
        newMinThresholdStakePercentage,
      );
      expect(await governor.minVotesToPass()).equal(newMinVotesToPass);
      expect(await governor.proposalThreshold()).equal(newProposalThreshold);
      expect(await governor.proposalActivePeriod()).equal(
        newProposalActivePeriod,
      );
    });
  });

  describe('addProposal', () => {
    const proposalTitle = 'Test Title';
    const proposalLink = utils.toUtf8Bytes('Test Link');
    const proposalDescription = 'Test Description';

    it('Revert to add proposal with less threshold', async () => {
      await expect(
        governor
          .connect(accounts[1])
          .addProposal(proposalTitle, proposalLink, proposalDescription),
      ).to.be.revertedWith('QG_NOT_ENOUGH_INACTIVE_VOTES');
    });

    it('Should create new proposal', async () => {
      await quartz
        .connect(owner)
        .stake(proposalThreshold, proposalSubmitter.address, '1');

      expect(await quartz.getCurrentVotes(proposalSubmitter.address)).equal(
        proposalThreshold,
      );
      const tx = await governor
        .connect(proposalSubmitter)
        .addProposal(proposalTitle, proposalLink, proposalDescription);
      let currentTime = (await getCurrentTime()).toNumber();
      expect(await quartz.getCurrentVotes(proposalSubmitter.address)).equal(0);
      expect(await quartz.getCurrentVotes(governor.address)).equal(
        proposalThreshold,
      );
      // await expect(tx)
      //   .to.emit(governor, 'ProposalAdded')
      //   .withArgs(
      //     proposalSubmitter.address,
      //     2,
      //     proposalTitle,
      //     proposalLink,
      //     proposalDescription,
      //     currentTime + proposalActivePeriod,
      //   );
      expect(await governor.lastVoteId()).equal(4);

      const proposal = await governor.getProposal('2');
      expect(proposal.proposalStatus).equal(1);
      expect(proposal.submitter).equal(proposalSubmitter.address);
      expect(proposal.staked).equal(proposalThreshold);
      expect(proposal.expiration).equal(currentTime + proposalActivePeriod);
      const positiveVotes = proposal.positiveVotes;
      const negativeVotes = proposal.negativeVotes;
      expect(positiveVotes.id).equal(3);
      expect(positiveVotes.totalVotes).equal(0);
      expect(positiveVotes.convictionLast).equal(0);
      expect(positiveVotes.blockLast).equal(0);
      expect(negativeVotes.id).equal(4);
      expect(negativeVotes.totalVotes).equal(0);
      expect(negativeVotes.convictionLast).equal(0);
      expect(negativeVotes.blockLast).equal(0);
      expect(await governor.proposalCounter()).equal(3);
    });
  });

  describe('cancelProposal', () => {
    const proposalTitle = 'Test Title';
    const proposalLink = utils.toUtf8Bytes('Test Link');
    const proposalDescription = 'Test Description';

    beforeEach(async () => {
      await quartz
        .connect(owner)
        .stake(proposalThreshold, proposalSubmitter.address, '1');
      await governor
        .connect(proposalSubmitter)
        .addProposal(proposalTitle, proposalLink, proposalDescription);
    });

    it('Revert to cancel non-exist proposal', async () => {
      await expect(
        governor.connect(cancelProposalsRole).cancelProposal('3'),
      ).to.be.revertedWith('QG_PROPOSAL_DOES_NOT_EXIST');
    });

    it('Revert to cancel abstain proposal', async () => {
      await expect(
        governor.connect(cancelProposalsRole).cancelProposal('1'),
      ).to.be.revertedWith('QG_CANNOT_CANCEL_ABSTAIN_PROPOSAL');
    });

    it('Revert to cancel inactive proposal', async () => {
      await governor.connect(cancelProposalsRole).cancelProposal('2');

      await expect(
        governor.connect(cancelProposalsRole).cancelProposal('2'),
      ).to.be.revertedWith('QG_PROPOSAL_NOT_ACTIVE');
    });

    it('Revert to cancel without permission', async () => {
      await expect(
        governor.connect(accounts[8]).cancelProposal('2'),
      ).to.be.revertedWith('QG_SENDER_CANNOT_CANCEL');
    });

    it('Proposal submitter can cancel', async () => {
      const tx = await governor.connect(proposalSubmitter).cancelProposal('2');
      await expect(tx).to.emit(governor, 'ProposalCancelled').withArgs(2);
      expect(await governor.lastVoteId()).equal(4);

      const proposal = await governor.getProposal('2');
      expect(proposal.proposalStatus).equal(0);
      expect(proposal.staked).equal(0);
      expect(await quartz.getCurrentVotes(proposalSubmitter.address)).equal(
        proposalThreshold,
      );
      expect(await quartz.getCurrentVotes(governor.address)).equal(0);
    });

    it('User with cancellable role can cancel', async () => {
      const tx = await governor
        .connect(cancelProposalsRole)
        .cancelProposal('2');
      await expect(tx).to.emit(governor, 'ProposalCancelled').withArgs(2);
      expect(await governor.lastVoteId()).equal(4);

      const proposal = await governor.getProposal('2');
      expect(proposal.proposalStatus).equal(0);
      expect(proposal.staked).equal(0);
      expect(await quartz.getCurrentVotes(proposalSubmitter.address)).equal(
        proposalThreshold,
      );
      expect(await quartz.getCurrentVotes(governor.address)).equal(0);
    });

    it('Anyone can cancel after expiration', async () => {
      await time.increase(proposalActivePeriod + 1);
      const tx = await governor.connect(accounts[8]).cancelProposal('2');
      await expect(tx).to.emit(governor, 'ProposalCancelled').withArgs(2);
      expect(await governor.lastVoteId()).equal(4);

      const proposal = await governor.getProposal('2');
      expect(proposal.proposalStatus).equal(0);
      expect(proposal.staked).equal(0);
      expect(await quartz.getCurrentVotes(proposalSubmitter.address)).equal(
        proposalThreshold,
      );
      expect(await quartz.getCurrentVotes(governor.address)).equal(0);
    });
  });

  describe('executeProposal', () => {
    const proposalTitle = 'Test Title';
    const proposalLink = utils.toUtf8Bytes('Test Link');
    const proposalDescription = 'Test Description';

    beforeEach(async () => {
      await quartz
        .connect(owner)
        .stake(proposalThreshold, proposalSubmitter.address, '1');
      await governor
        .connect(proposalSubmitter)
        .addProposal(proposalTitle, proposalLink, proposalDescription);
    });

    it('Revert to execute to non-exist proposal', async () => {
      await expect(
        governor.connect(accounts[1]).executeProposal('3'),
      ).to.be.revertedWith('QG_PROPOSAL_DOES_NOT_EXIST');
    });

    it('Revert to execute to abstain proposal', async () => {
      await expect(
        governor.connect(accounts[1]).executeProposal('1'),
      ).to.be.revertedWith('QG_CANNOT_EXECUTE_ABSTAIN_PROPOSAL');
    });

    it('Revert to execute to inactive proposal', async () => {
      await governor.connect(cancelProposalsRole).cancelProposal('2');

      await expect(
        governor.connect(accounts[1]).executeProposal('2'),
      ).to.be.revertedWith('QG_PROPOSAL_NOT_ACTIVE');
    });

    it('Revert to execute if positive conviction is less than negative (1)', async () => {
      const amount = BigNumber.from('1000').mul(decimalsUnit);
      const votesToCast = BigNumber.from('10').mul(decimalsUnit);
      const period = BigNumber.from('3600');
      let sender = accounts[2];
      let beneficiary = accounts[6];
      await quartz.connect(owner).transfer(sender.address, amount);
      await quartz.connect(sender).stake(amount, beneficiary.address, period);
      await governor.connect(beneficiary).castVotes('2', votesToCast, false);
      await time.advanceBlock();
      await expect(
        governor.connect(accounts[1]).executeProposal('2'),
      ).to.be.revertedWith('QG_INSUFFICIENT_CONVICTION');
    });

    it('Revert to execute if positive conviction is less than negative (2)', async () => {
      const amount = BigNumber.from('1000').mul(decimalsUnit);
      const votesToCast = BigNumber.from('10').mul(decimalsUnit);
      const period = BigNumber.from('3600');
      let sender = accounts[2];
      let beneficiary = accounts[6];
      let beneficiary1 = accounts[7];
      await quartz
        .connect(owner)
        .transfer(sender.address, amount.mul(BigNumber.from('2')));
      await quartz.connect(sender).stake(amount, beneficiary.address, period);
      await quartz.connect(sender).stake(amount, beneficiary1.address, period);
      await governor.connect(beneficiary).castVotes('2', votesToCast, true);
      await time.advanceBlock();
      await time.advanceBlock();
      await governor.connect(beneficiary1).castVotes('2', votesToCast, false);
      await time.advanceBlock();
      await expect(
        governor.connect(accounts[1]).executeProposal('2'),
      ).to.be.revertedWith('QG_INSUFFICIENT_CONVICTION');
    });

    it('Should execute proposal', async () => {
      const amount = BigNumber.from('1000').mul(decimalsUnit);
      const votesToCast = BigNumber.from('10').mul(decimalsUnit);
      const period = BigNumber.from('3600');
      let sender = accounts[2];
      let beneficiary = accounts[6];
      await quartz.connect(owner).transfer(sender.address, amount);
      await quartz.connect(sender).stake(amount, beneficiary.address, period);
      await governor.connect(beneficiary).castVotes('2', votesToCast, true);
      const userVotes = await governor.getProposalUserVotes(
        '2',
        beneficiary.address,
      );
      expect(userVotes[0]).equal(votesToCast);
      expect(userVotes[1]).equal('0');
      const increaseBlock = 10000;
      for (let i = 0; i < increaseBlock; i += 1) {
        await time.advanceBlock();
      }
      const conviction = BigNumber.from(
        await governor.calculateConviction(increaseBlock + 1, '0', votesToCast),
      );
      const tx = await governor.connect(accounts[1]).executeProposal('2');
      await expect(tx)
        .to.emit(governor, 'ProposalExecuted')
        .withArgs('2', conviction, '0');
      const proposal = await governor.getProposal('2');
      expect(proposal.proposalStatus).equal(2);
      expect(proposal.staked).equal(0);
      expect(await quartz.getCurrentVotes(proposalSubmitter.address)).equal(
        proposalThreshold,
      );
      expect(await quartz.getCurrentVotes(governor.address)).equal(votesToCast);
    });
  });

  describe('castVotes', () => {
    const proposalTitle = 'Test Title';
    const proposalLink = utils.toUtf8Bytes('Test Link');
    const proposalDescription = 'Test Description';
    const amount = BigNumber.from('1000').mul(decimalsUnit);
    const votesToCast = BigNumber.from('10').mul(decimalsUnit);
    const period = BigNumber.from('3600');
    let sender;
    let beneficiary;

    beforeEach(async () => {
      await quartz
        .connect(owner)
        .stake(
          proposalThreshold.mul(BigNumber.from('3')),
          proposalSubmitter.address,
          '1',
        );
      await governor
        .connect(proposalSubmitter)
        .addProposal(proposalTitle, proposalLink, proposalDescription);

      sender = accounts[2];
      beneficiary = accounts[6];
      await quartz
        .connect(owner)
        .transfer(
          sender.address,
          totalSupply.sub(proposalThreshold.mul(BigNumber.from('3'))),
        );
      await quartz.connect(sender).stake(amount, beneficiary.address, period);
    });

    it('Revert to cast zero votes', async () => {
      await expect(
        governor.connect(beneficiary).castVotes('2', '0', true),
      ).to.be.revertedWith('QG_AMOUNT_CAN_NOT_BE_ZERO');

      await expect(
        governor.connect(accounts[1]).castAllVotes('2', true),
      ).to.be.revertedWith('QG_AMOUNT_CAN_NOT_BE_ZERO');
    });

    it('Revert to vote to inactive proposal', async () => {
      await governor.connect(cancelProposalsRole).cancelProposal('2');

      await expect(
        governor.connect(beneficiary).castVotes('2', '4', true),
      ).to.be.revertedWith('QG_PROPOSAL_NOT_ACTIVE');
    });

    it('Revert to vote to non-exist proposal', async () => {
      await expect(
        governor.connect(beneficiary).castVotes('3', '4', true),
      ).to.be.revertedWith('QG_PROPOSAL_DOES_NOT_EXIST');
    });

    it('Revert to vote positive if voted to negative already', async () => {
      await governor.connect(beneficiary).castVotes('2', votesToCast, false);
      await expect(
        governor.connect(beneficiary).castVotes('2', '4', true),
      ).to.be.revertedWith('QG_ALREADY_NEGATIVE_VOTED');
    });

    it('Revert to vote negative if voted to positive already', async () => {
      await governor.connect(beneficiary).castVotes('2', votesToCast, true);
      await expect(
        governor.connect(beneficiary).castVotes('2', '4', false),
      ).to.be.revertedWith('QG_ALREADY_POSITIVE_VOTED');
    });

    it('Revert to vote to bigger amounts than available votes', async () => {
      await governor.connect(beneficiary).castVotes('2', votesToCast, true);
      await governor
        .connect(proposalSubmitter)
        .addProposal(proposalTitle, proposalLink, proposalDescription);
      await expect(
        governor
          .connect(beneficiary)
          .castVotes('3', amount.sub(votesToCast).add('1'), true),
      ).to.be.revertedWith('QG_NOT_ENOUGH_INACTIVE_VOTES');
    });

    it('Should vote to positive', async () => {
      const tx = await governor
        .connect(beneficiary)
        .castVotes('2', votesToCast, true);
      await expect(tx)
        .to.emit(governor, 'VoteCasted')
        .withArgs(beneficiary.address, '2', votesToCast, '0', true);
      const currentBlock = await getCurrentBlock();
      expect(await governor.userVotes(3, beneficiary.address)).equal(
        votesToCast,
      );
      expect(await governor.userVotes(4, beneficiary.address)).equal(0);
      expect(await governor.getTotalUserVotes(beneficiary.address)).equal(
        votesToCast,
      );
      expect(await governor.totalVotes()).equal(votesToCast);
      const proposal = await governor.getProposal('2');
      const positiveVotes = proposal.positiveVotes;
      expect(positiveVotes.blockLast).equal(currentBlock);
      expect(positiveVotes.convictionLast).equal('0');
      const negativeVotes = proposal.negativeVotes;
      expect(negativeVotes.blockLast).equal(0);
      expect(negativeVotes.convictionLast).equal('0');
      expect(
        (await governor.getVoterCastedProposals(beneficiary.address))[0],
      ).equal('2');
    });

    it('Should vote to negative', async () => {
      const tx = await governor
        .connect(beneficiary)
        .castVotes('2', votesToCast, false);
      await expect(tx)
        .to.emit(governor, 'VoteCasted')
        .withArgs(beneficiary.address, '2', votesToCast, '0', false);
      const currentBlock = await getCurrentBlock();
      expect(await governor.userVotes(4, beneficiary.address)).equal(
        votesToCast,
      );
      expect(await governor.userVotes(3, beneficiary.address)).equal(0);
      expect(await governor.getTotalUserVotes(beneficiary.address)).equal(
        votesToCast,
      );
      expect(await governor.totalVotes()).equal(votesToCast);
      const proposal = await governor.getProposal('2');
      const positiveVotes = proposal.positiveVotes;
      expect(positiveVotes.blockLast).equal(0);
      expect(positiveVotes.convictionLast).equal('0');
      const negativeVotes = proposal.negativeVotes;
      expect(negativeVotes.blockLast).equal(currentBlock);
      expect(negativeVotes.convictionLast).equal('0');
      expect(
        (await governor.getVoterCastedProposals(beneficiary.address))[0],
      ).equal('2');
    });

    it('Calculate and set conviction at cast votes', async () => {
      await governor.connect(beneficiary).castVotes('2', votesToCast, true);
      let votesToCast1 = BigNumber.from('20').mul(decimalsUnit);
      const increaseBlock = 10;
      for (let i = 0; i < increaseBlock; i += 1) {
        await time.advanceBlock();
      }
      const conviction = BigNumber.from(
        await governor.calculateConviction(increaseBlock + 1, '0', votesToCast),
      );
      const tx = await governor
        .connect(beneficiary)
        .castVotes('2', votesToCast1, true);
      const currentBlock = await getCurrentBlock();
      await expect(tx)
        .to.emit(governor, 'VoteCasted')
        .withArgs(beneficiary.address, '2', votesToCast1, conviction, true);
      expect(await governor.userVotes(3, beneficiary.address)).equal(
        votesToCast.add(votesToCast1),
      );
      expect(await governor.userVotes(4, beneficiary.address)).equal(0);
      expect(await governor.getTotalUserVotes(beneficiary.address)).equal(
        votesToCast.add(votesToCast1),
      );
      expect(await governor.totalVotes()).equal(votesToCast.add(votesToCast1));
      const proposal = await governor.getProposal('2');
      const positiveVotes = proposal.positiveVotes;
      expect(positiveVotes.blockLast).equal(currentBlock);
      expect(positiveVotes.convictionLast).equal(conviction);
      const negativeVotes = proposal.negativeVotes;
      expect(negativeVotes.blockLast).equal(0);
      expect(negativeVotes.convictionLast).equal('0');
    });

    it('Should withdraw inactive votes if amount is less than remaining', async () => {
      const votesToCast = BigNumber.from('400').mul(decimalsUnit);
      const votesToCast1 = BigNumber.from('700').mul(decimalsUnit);
      const votesToCast2 = BigNumber.from('500').mul(decimalsUnit);
      await governor
        .connect(proposalSubmitter)
        .addProposal(proposalTitle, proposalLink, proposalDescription);
      await governor
        .connect(proposalSubmitter)
        .addProposal(proposalTitle, proposalLink, proposalDescription);
      await governor.connect(beneficiary).castVotes('2', votesToCast, true);
      await governor.connect(beneficiary).castVotes('4', votesToCast2, true);
      governor.connect(cancelProposalsRole).cancelProposal('2');
      governor.connect(cancelProposalsRole).cancelProposal('4');

      expect(await governor.userVotes(3, beneficiary.address)).equal(
        votesToCast,
      );
      expect(await governor.userVotes(7, beneficiary.address)).equal(
        votesToCast2,
      );
      expect(await governor.getTotalUserVotes(beneficiary.address)).equal(
        votesToCast.add(votesToCast2),
      );
      expect(await governor.totalVotes()).equal(votesToCast.add(votesToCast2));
      await governor.connect(beneficiary).castVotes('3', votesToCast1, true);
      expect(await governor.userVotes(3, beneficiary.address)).equal('0');
      expect(await governor.userVotes(5, beneficiary.address)).equal(
        votesToCast1,
      );
      expect(await governor.userVotes(7, beneficiary.address)).equal('0');
      expect(await governor.getTotalUserVotes(beneficiary.address)).equal(
        votesToCast1,
      );
      expect(await governor.totalVotes()).equal(votesToCast1);
    });
  });

  describe('withdrawVotes', () => {
    const proposalTitle = 'Test Title';
    const proposalLink = utils.toUtf8Bytes('Test Link');
    const proposalDescription = 'Test Description';
    const amount = BigNumber.from('1000').mul(decimalsUnit);
    const votesToCast = BigNumber.from('10').mul(decimalsUnit);
    const votesToWithdraw = BigNumber.from('8').mul(decimalsUnit);
    const period = BigNumber.from('3600');
    let sender;
    let beneficiary;

    beforeEach(async () => {
      await quartz
        .connect(owner)
        .stake(
          proposalThreshold.mul(BigNumber.from('3')),
          proposalSubmitter.address,
          '1',
        );
      await governor
        .connect(proposalSubmitter)
        .addProposal(proposalTitle, proposalLink, proposalDescription);

      sender = accounts[2];
      beneficiary = accounts[6];
      await quartz
        .connect(owner)
        .transfer(
          sender.address,
          totalSupply.sub(proposalThreshold.mul(BigNumber.from('3'))),
        );
      await quartz.connect(sender).stake(amount, beneficiary.address, period);
    });

    it('Revert to withdraw zero votes', async () => {
      await expect(
        governor.connect(beneficiary).withdrawVotes('2', '0', true),
      ).to.be.revertedWith('QG_AMOUNT_CAN_NOT_BE_ZERO');

      await expect(
        governor.connect(accounts[1]).withdrawAllVotesFromProposal('2', true),
      ).to.be.revertedWith('QG_AMOUNT_CAN_NOT_BE_ZERO');
    });

    it('Revert to withdraw votes from non-exist proposal', async () => {
      await expect(
        governor.connect(beneficiary).withdrawVotes('3', '4', true),
      ).to.be.revertedWith('QG_PROPOSAL_DOES_NOT_EXIST');
    });

    it('Revert to withdraw if amount is bigger than voted', async () => {
      await governor.connect(beneficiary).castVotes('2', votesToCast, true);

      await expect(
        governor
          .connect(beneficiary)
          .withdrawVotes('2', votesToCast.add('1'), true),
      ).to.be.revertedWith('QG_WITHDRAW_MORE_THAN_VOTED');

      await expect(
        governor.connect(beneficiary).withdrawVotes('2', votesToCast, false),
      ).to.be.revertedWith('QG_WITHDRAW_MORE_THAN_VOTED');
    });

    it('Should withdraw votes', async () => {
      await governor.connect(beneficiary).castVotes('2', votesToCast, true);
      const increaseBlock = 10;
      for (let i = 0; i < increaseBlock; i += 1) {
        await time.advanceBlock();
      }
      const conviction = BigNumber.from(
        await governor.calculateConviction(increaseBlock + 1, '0', votesToCast),
      );

      const tx = await governor
        .connect(beneficiary)
        .withdrawVotes('2', votesToWithdraw, true);

      await expect(tx)
        .to.emit(governor, 'VoteWithdrawn')
        .withArgs(beneficiary.address, '2', votesToWithdraw, conviction, true);
      const currentBlock = await getCurrentBlock();
      expect(await governor.userVotes(3, beneficiary.address)).equal(
        votesToCast.sub(votesToWithdraw),
      );
      expect(await governor.userVotes(4, beneficiary.address)).equal(0);
      expect(await governor.getTotalUserVotes(beneficiary.address)).equal(
        votesToCast.sub(votesToWithdraw),
      );
      expect(await governor.totalVotes()).equal(
        votesToCast.sub(votesToWithdraw),
      );
      const proposal = await governor.getProposal('2');
      const positiveVotes = proposal.positiveVotes;
      expect(positiveVotes.blockLast).equal(currentBlock);
      expect(positiveVotes.convictionLast).equal(conviction);
      const negativeVotes = proposal.negativeVotes;
      expect(negativeVotes.blockLast).equal(0);
      expect(negativeVotes.convictionLast).equal('0');
      expect(
        (await governor.getVoterCastedProposals(beneficiary.address))[0],
      ).equal('2');
    });

    it('Should remove casted proposal id if withdraw all', async () => {
      await governor.connect(beneficiary).castVotes('2', votesToCast, true);
      const increaseBlock = 10;
      for (let i = 0; i < increaseBlock; i += 1) {
        await time.advanceBlock();
      }
      const conviction = BigNumber.from(
        await governor.calculateConviction(increaseBlock + 1, '0', votesToCast),
      );

      const tx = await governor
        .connect(beneficiary)
        .withdrawAllVotesFromProposal('2', true);

      await expect(tx)
        .to.emit(governor, 'VoteWithdrawn')
        .withArgs(beneficiary.address, '2', votesToCast, conviction, true);
      const currentBlock = await getCurrentBlock();
      expect(await governor.userVotes(3, beneficiary.address)).equal('0');
      expect(await governor.userVotes(4, beneficiary.address)).equal(0);
      expect(await governor.getTotalUserVotes(beneficiary.address)).equal('0');
      expect(await governor.totalVotes()).equal('0');
      const proposal = await governor.getProposal('2');
      const positiveVotes = proposal.positiveVotes;
      expect(positiveVotes.blockLast).equal(currentBlock);
      expect(positiveVotes.convictionLast).equal(conviction);
      const negativeVotes = proposal.negativeVotes;
      expect(negativeVotes.blockLast).equal(0);
      expect(negativeVotes.convictionLast).equal('0');
      expect(
        (await governor.getVoterCastedProposals(beneficiary.address)).length,
      ).equal(0);
      expect(
        (await governor.getVoterCastedProposals(beneficiary.address)).length,
      ).equal(0);
    });
  });

  describe('withdrawAllInactiveVotes', () => {
    const proposalTitle = 'Test Title';
    const proposalLink = utils.toUtf8Bytes('Test Link');
    const proposalDescription = 'Test Description';
    const amount = BigNumber.from('1000').mul(decimalsUnit);
    let votesToCasts;
    let votesToCasts1;
    const period = BigNumber.from('3600');
    let proposalCount = 5;
    let sender;
    let beneficiary;
    let beneficiary1;

    beforeEach(async () => {
      votesToCasts = [];
      votesToCasts1 = [];
      await quartz
        .connect(owner)
        .stake(
          proposalThreshold.mul(BigNumber.from(proposalCount.toString())),
          proposalSubmitter.address,
          '1',
        );
      for (let i = 0; i < proposalCount; i += 1) {
        await governor
          .connect(proposalSubmitter)
          .addProposal(proposalTitle, proposalLink, proposalDescription);
        votesToCasts.push(
          BigNumber.from((10 + i * 2).toString()).mul(decimalsUnit),
        );
        votesToCasts1.push(
          BigNumber.from((13 + i).toString()).mul(decimalsUnit),
        );
      }

      sender = accounts[2];
      beneficiary = accounts[6];
      beneficiary1 = accounts[7];
      await quartz
        .connect(owner)
        .transfer(
          sender.address,
          totalSupply.sub(
            proposalThreshold.mul(BigNumber.from(proposalCount.toString())),
          ),
        );
      await quartz.connect(sender).stake(amount, beneficiary.address, period);
      await quartz.connect(sender).stake(amount, beneficiary1.address, period);
    });

    it('Should withdraw inactive votes', async () => {
      let totalStaked = BigNumber.from('0');
      let totalStaked1 = BigNumber.from('0');
      for (let i = 0; i < proposalCount; i += 1) {
        await governor
          .connect(beneficiary)
          .castVotes(i + 2, votesToCasts[i], true);
        await governor
          .connect(beneficiary1)
          .castVotes(i + 2, votesToCasts1[i], true);
        totalStaked = totalStaked.add(votesToCasts[i]);
        totalStaked1 = totalStaked1.add(votesToCasts1[i]);
        await time.advanceBlock();
        await time.advanceBlock();
      }

      await governor.connect(cancelProposalsRole).cancelProposal(4);
      await governor.connect(cancelProposalsRole).cancelProposal(5);

      expect(await governor.getTotalUserVotes(beneficiary.address)).equal(
        totalStaked,
      );
      expect(await governor.getTotalUserVotes(beneficiary1.address)).equal(
        totalStaked1,
      );
      expect(await governor.totalVotes()).equal(totalStaked.add(totalStaked1));

      await governor.connect(beneficiary).withdrawAllInactiveVotes();

      expect(await governor.getTotalUserVotes(beneficiary.address)).equal(
        totalStaked.sub(votesToCasts[2]).sub(votesToCasts[3]),
      );
      expect(await governor.getTotalUserVotes(beneficiary1.address)).equal(
        totalStaked1,
      );
      expect(await governor.totalVotes()).equal(
        totalStaked.add(totalStaked1).sub(votesToCasts[2]).sub(votesToCasts[3]),
      );

      const castedProposals = await governor.getVoterCastedProposals(
        beneficiary.address,
      );
      expect(castedProposals.length).equal(3);
      expect(castedProposals[0]).equal(2);
      expect(castedProposals[1]).equal(3);
      expect(castedProposals[2]).equal(6);
    });
  });

  describe('withdrawRequiredVotes', () => {
    const proposalTitle = 'Test Title';
    const proposalLink = utils.toUtf8Bytes('Test Link');
    const proposalDescription = 'Test Description';
    const amount = BigNumber.from('400').mul(decimalsUnit);
    const amount2 = BigNumber.from('600').mul(decimalsUnit);
    let votesToCasts;
    let votesToCasts1;
    const period = BigNumber.from('3600');
    let proposalCount = 5;
    let sender;
    let sender2;
    let beneficiary;

    beforeEach(async () => {
      votesToCasts = [];
      votesToCasts1 = [];
      await quartz
        .connect(owner)
        .stake(
          proposalThreshold.mul(BigNumber.from((proposalCount + 2).toString())),
          proposalSubmitter.address,
          '1',
        );
      for (let i = 0; i < proposalCount; i += 1) {
        await governor
          .connect(proposalSubmitter)
          .addProposal(proposalTitle, proposalLink, proposalDescription);
        votesToCasts.push(
          BigNumber.from((10 + i * 2).toString()).mul(decimalsUnit),
        );
        votesToCasts1.push(
          BigNumber.from((13 + i).toString()).mul(decimalsUnit),
        );
      }

      sender = accounts[2];
      sender2 = accounts[5];
      beneficiary = accounts[6];
      beneficiary1 = accounts[7];
      await quartz.connect(owner).transfer(sender.address, amount);
      await quartz.connect(sender).stake(amount, beneficiary.address, period);
      await quartz.connect(owner).transfer(sender2.address, amount2);
      await quartz.connect(sender2).stake(amount2, beneficiary.address, period);
    });

    it('Revert to if caller is not QUARTZ token', async () => {
      await expect(
        governor
          .connect(accounts[2])
          .withdrawRequiredVotes(accounts[2].address, '10000', false),
      ).to.be.revertedWith('QG_ONLY_QUARTZ');
    });

    it('Should withdraw required votes by QUARTZ token', async () => {
      const votesToCast = BigNumber.from('400').mul(decimalsUnit);
      const votesToCast2 = BigNumber.from('500').mul(decimalsUnit);
      await governor
        .connect(proposalSubmitter)
        .addProposal(proposalTitle, proposalLink, proposalDescription);
      await governor
        .connect(proposalSubmitter)
        .addProposal(proposalTitle, proposalLink, proposalDescription);
      await governor.connect(beneficiary).castVotes('2', votesToCast, true);
      await governor.connect(beneficiary).castVotes('4', votesToCast2, true);
      governor.connect(cancelProposalsRole).cancelProposal('4');

      expect(await governor.userVotes(3, beneficiary.address)).equal(
        votesToCast,
      );
      expect(await governor.userVotes(7, beneficiary.address)).equal(
        votesToCast2,
      );
      expect(await governor.getTotalUserVotes(beneficiary.address)).equal(
        votesToCast.add(votesToCast2),
      );
      expect(await governor.totalVotes()).equal(votesToCast.add(votesToCast2));

      await time.increase(period.toString());
      await quartz.connect(sender).unstake('1');
      await quartz.connect(sender2).unstake('2');

      expect(await governor.userVotes(3, beneficiary.address)).equal('0');
      expect(await governor.userVotes(5, beneficiary.address)).equal('0');
      expect(await governor.userVotes(7, beneficiary.address)).equal('0');
      expect(await governor.getTotalUserVotes(beneficiary.address)).equal('0');
      expect(await governor.totalVotes()).equal('0');
    });

    it('Should cancel proposals if necessary', async () => {
      const votesToCast = BigNumber.from('400').mul(decimalsUnit);
      const votesToCast2 = BigNumber.from('500').mul(decimalsUnit);
      await governor
        .connect(proposalSubmitter)
        .addProposal(proposalTitle, proposalLink, proposalDescription);
      await governor
        .connect(proposalSubmitter)
        .addProposal(proposalTitle, proposalLink, proposalDescription);

      await quartz
        .connect(owner)
        .stake(proposalThreshold, beneficiary.address, period);
      await governor
        .connect(beneficiary)
        .addProposal(proposalTitle, proposalLink, proposalDescription);

      await governor.connect(beneficiary).castVotes('2', votesToCast, true);
      await governor.connect(beneficiary).castVotes('4', votesToCast2, true);
      governor.connect(cancelProposalsRole).cancelProposal('4');

      expect(await governor.userVotes(3, beneficiary.address)).equal(
        votesToCast,
      );
      expect(await governor.userVotes(7, beneficiary.address)).equal(
        votesToCast2,
      );
      expect(await governor.getTotalUserVotes(beneficiary.address)).equal(
        votesToCast.add(votesToCast2),
      );
      expect(await governor.totalVotes()).equal(votesToCast.add(votesToCast2));

      await time.increase(period.toString());
      await quartz.connect(owner).unstake('3');

      expect(await governor.userVotes(3, beneficiary.address)).equal('0');
      expect(await governor.userVotes(5, beneficiary.address)).equal('0');
      expect(await governor.userVotes(7, beneficiary.address)).equal('0');
      expect(await governor.getTotalUserVotes(beneficiary.address)).equal('0');
      expect(await governor.totalVotes()).equal('0');

      const proposal = await governor.getProposal('9');
      expect(proposal.proposalStatus).equal(0);
      expect(proposal.submitter).equal(beneficiary.address);
      expect(proposal.staked).equal(0);
    });
  });
});
