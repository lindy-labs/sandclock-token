pragma solidity 0.7.3;

library SafeMath64 {
    function add(uint64 a, uint64 b) internal pure returns (uint64) {
        uint64 c = a + b;
        require(c >= a, "SafeMath: addition overflow");

        return c;
    }

    function sub(uint64 a, uint64 b) internal pure returns (uint64) {
        return sub(a, b, "SafeMath: subtraction overflow");
    }

    function sub(
        uint64 a,
        uint64 b,
        string memory errorMessage
    ) internal pure returns (uint64) {
        require(b <= a, errorMessage);
        uint64 c = a - b;

        return c;
    }

    function mul(uint64 a, uint64 b) internal pure returns (uint64) {
        if (a == 0) {
            return 0;
        }

        uint64 c = a * b;
        require(c / a == b, "SafeMath: multiplication overflow");

        return c;
    }

    function div(uint64 a, uint64 b) internal pure returns (uint64) {
        return div(a, b, "SafeMath: division by zero");
    }

    function div(
        uint64 a,
        uint64 b,
        string memory errorMessage
    ) internal pure returns (uint64) {
        require(b > 0, errorMessage);
        uint64 c = a / b;
        // assert(a == b * c + a % b); // There is no case in which this doesn't hold

        return c;
    }

    function mod(uint64 a, uint64 b) internal pure returns (uint64) {
        return mod(a, b, "SafeMath: modulo by zero");
    }

    function mod(
        uint64 a,
        uint64 b,
        string memory errorMessage
    ) internal pure returns (uint64) {
        require(b != 0, errorMessage);
        return a % b;
    }
}
