pragma solidity ^0.8.9;

contract Echidna_Formula {
    uint256 t1;
    uint256 t2;

    constructor() {}

    function f(
        uint32 _weight,
        uint32 _D,
        uint32 _denom,
        uint32 _decay,
        uint32 _totalVotes
    ) public {
        uint256 weight = uint256(_weight);
        uint256 D = uint256(_D);
        uint256 denom = uint256(_denom);
        uint256 decay = uint256(_decay);
        uint256 totalVotes = uint256(_totalVotes);

        // make values different to ensure that crashes on this function result in an invariant failing
        t1 = 1;
        t2 = 2;

        t1 =
            ((((((weight << 128) / D) / ((denom * denom) >> 64)) * D) /
                (D - decay)) * totalVotes) >>
            64;

        t2 =
            (((weight << 128) / (((denom * denom) >> 64) * (D - decay))) *
                totalVotes) >>
            64;
    }

    function echidna_valuesAreEqual() public returns (bool) {
        return t1 == t2;
    }
}
