// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title EIP712Domain
 * @dev Base contract for EIP-712 domain separator functionality
 */
contract EIP712Domain {
    // EIP-712 Domain Separator
    bytes32 public immutable DOMAIN_SEPARATOR;

    constructor() {
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("PropertyRental")),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );
    }

    /**
     * @dev Returns the domain separator for the current chain
     */
    function getDomainSeparator() public view virtual returns (bytes32) {
        return DOMAIN_SEPARATOR;
    }
} 