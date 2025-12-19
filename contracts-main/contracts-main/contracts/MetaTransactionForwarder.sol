// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./EIP712Domain.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title MetaTransactionForwarder
 * @dev Allows users to sign messages and have them executed by a relayer
 */
contract MetaTransactionForwarder is EIP712Domain {
	using ECDSA for bytes32;

	// Meta-transaction struct
	struct MetaTransaction {
		address from;
		address to;
		uint256 value;
		bytes data;
		uint256 nonce;
		uint256 deadline;
	}

	// Nonce mapping to prevent replay attacks
	mapping(address => uint256) public nonces;

	// Events
	event MetaTransactionExecuted(
		address indexed from,
		address indexed to,
		bytes data,
		uint256 nonce
	);

	// EIP-712 type hash for MetaTransaction
	bytes32 public constant META_TRANSACTION_TYPEHASH = keccak256(
		"MetaTransaction(address from,address to,uint256 value,bytes data,uint256 nonce,uint256 deadline)"
	);

	/**
	 * @dev Execute a meta-transaction
	 * @param _from The address that signed the transaction
	 * @param _to The target contract address
	 * @param _value The amount of ETH to send
	 * @param _data The function call data
	 * @param _deadline The deadline for the transaction
	 * @param _signature The signature from the user
	 */
	function executeMetaTransaction(
		address _from,
		address _to,
		uint256 _value,
		bytes calldata _data,
		uint256 _deadline,
		bytes calldata _signature
	) external payable returns (bytes memory) {
		require(block.timestamp <= _deadline, "MetaTransaction: Transaction expired");
		require(_from != address(0), "MetaTransaction: Invalid from address");

		uint256 nonce = nonces[_from]; // Use current nonce for signature
		// Verify the signature
		bytes32 structHash = keccak256(
			abi.encode(
				META_TRANSACTION_TYPEHASH,
				_from,
				_to,
				_value,
				keccak256(_data),
				nonce,
				_deadline
			)
		);

		bytes32 hash = keccak256(
			abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash)
		);

		address signer = hash.recover(_signature);
		require(signer == _from, "MetaTransaction: Invalid signature");

		nonces[_from]++; // Increment nonce only after successful verification

		// Execute the transaction with ERC-2771 style appended sender context
		bytes memory callData = abi.encodePacked(_data, _from);
		(bool success, bytes memory returnData) = _to.call{value: _value}(callData);
		if (!success) {
			// Bubble up revert reason from the target call if present
			if (returnData.length > 0) {
				/// @solidity memory-safe-assembly
				assembly {
					revert(add(returnData, 0x20), mload(returnData))
				}
			} else {
				revert("MetaTransaction: Transaction execution failed");
			}
		}

		emit MetaTransactionExecuted(_from, _to, _data, nonce);

		return returnData;
	}

	/**
	 * @dev Get the current nonce for an address
	 * @param _from The address to get the nonce for
	 */
	function getNonce(address _from) external view returns (uint256) {
		return nonces[_from];
	}

	/**
	 * @dev Get the domain separator for EIP-712
	 */
	function getDomainSeparator() public view override returns (bytes32) {
		return DOMAIN_SEPARATOR;
	}

	/**
	 * @dev Get the type hash for MetaTransaction
	 */
	function getMetaTransactionTypeHash() external pure returns (bytes32) {
		return META_TRANSACTION_TYPEHASH;
	}
} 