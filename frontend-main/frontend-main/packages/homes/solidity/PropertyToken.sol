// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title PropertyToken
 * @dev ERC20 token representing ownership of a property
 */
contract PropertyToken is ERC20, Ownable {
	// Property details
	string public propertyId;
	string public propertyURI; // IPFS URI for property metadata
	
	/**
	 * @dev Constructor that creates a new property token
	 * @param _propertyId Unique identifier for the property
	 * @param _propertyURI IPFS URI with property metadata
	 * @param _owner Initial owner of the property
	 */
	constructor(
		string memory _propertyId,
		string memory _propertyURI,
		string memory _name,
		string memory _symbol,
		address _owner
	) ERC20(_name, _symbol) Ownable(_owner) {
		propertyId = _propertyId;
		propertyURI = _propertyURI;
		
		// Mint 1000 tokens to the creator
		_mint(_owner, 1000 * 10**decimals());
	}
	
	/**
	 * @dev Update property metadata URI
	 * @param _newPropertyURI New IPFS URI for property details
	 */
	function updatePropertyURI(string memory _newPropertyURI) external onlyOwner {
		propertyURI = _newPropertyURI;
	}
} 