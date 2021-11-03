# Sandclock - Quartz

This is the project that holds the $QUARTZ token repo, governance system, and
vesting strategies for [Sandclock]

## Mainnet deployments

### ETH mainnet

| Contract           | Address                                    |
| ------------------ | ------------------------------------------ |
| QuartzToken        | 0xbA8A621b4a54e61C442F5Ec623687e2a942225ef |
| VestedRewards      | 0x5dD8905AEC612529361A35372EFD5b127BB182b3 |

### Polygon

| Contract           | Address                                    |
| ------------------ | ------------------------------------------ |
| ProxyAdmin         | 0x03B7309b093a5a4F5bbe4bbFea023C07D4ceea7B |
| Quartz             | 0xA91FE5a535967F52D3abEBDFFb3B306D964ace13 |
| QuartzGovernor     | TODO                                       |
| Phase I Vesting    | TODO                                       |

## Testnet deployments

### ETH Rinkeby

| Contract           | Address                                    |
| ------------------ | ------------------------------------------ |
| QuartzToken        | 0xA73292e0CeD7F1150e9E7d0f09e82a3640C87aCc |
| VestedRewards      | 0x9BC087c81AaA6140910943D73499e79c5bE3941F |

### Polygon mumbai

| Contract           | Address                                    |
| ------------------ | ------------------------------------------ |
| ProxyAdmin         | TODO                                       |
| Quartz             | TODO                                       |
| QuartzGovernor     | TODO                                       |
| Phase I Vesting    | TODO                                       |

## Contracts

### QuartzToken

The $QUARTZ token contract on the Ethereum blockchain. has only basic ERC-20 functionality

### Quartz

The polygon side of the $QUARTZ token. Is bridged to the Ethereum token via
Polygon's [PoS bridge].

Includes governance functionality.
Holders of this token are able to stake it into the contract, which grants them
voting rights that can be used to vote on proposals, or to grant voting power to
a delegate to vote on their behalf. Proposal logic is handled on `QuartzGovernor`.

### QuartzGovernor

Handles all voting done by $QUARTZ holders, via a [Conviction voting] mechanism,
whereby holding onto a voting decision for longer increases your voting power in
that decision.

### Vesting

Polygon contract with a vesting mechanism for Phase I investors. Initial
settings allow for withdrawals of up to 100 QUARTZ / day for each beneficiary.
These settings may be later adjusted by the team if need be.

### VestedRewards

A separate ERC20 token called $vestedQUARTZ can be minted by locking regular
$QUARTZ into it. This vestedQUARTZ acts as a distributable reward, subject to
vesting logic. Receivers of vestedQUARTZ can, over the course of a few months,
redeem the locked QUARTZ by burning vestedQUARTZ.

[Sandclock]: https://sandclock.org
[PoS bridge]: https://wallet.polygon.technology/bridge/
[Conviction voting]: https://medium.com/giveth/conviction-voting-a-novel-continuous-decision-making-alternative-to-governance-aa746cfb9475
