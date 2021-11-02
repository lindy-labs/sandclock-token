# Sandclock - Quartz

This is the project that holds the $QUARTZ token repo, governance system, and
vesting strategies for [Sandclock]

## Deployments

### ETH Mainnet

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

### VestedRewards



[Sandclock]: https://sandclock.org
[PoS bridge]: https://wallet.polygon.technology/bridge/
[Conviction voting]: https://medium.com/giveth/conviction-voting-a-novel-continuous-decision-making-alternative-to-governance-aa746cfb9475
