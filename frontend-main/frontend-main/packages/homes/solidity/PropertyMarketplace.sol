// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./PropertyToken.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/metatx/ERC2771Context.sol";

/**
 * @title PropertyMarketplace
 * @dev Manages property listings and token creation
 */
contract PropertyMarketplace is Ownable, ERC2771Context {
	// Platform fee percentage (3%) - represented with 1 decimal place (30 = 3.0%)
	uint16 public platformFeePercentage = 30;
	
	// Platform fee recipient address
	address payable public feeRecipient;
	
	// Property ID counter
	uint256 private _propertyIdCounter;
	
	// Property struct to store property information
	struct Property {
		string propertyId;
		address propertyTokenAddress;
		address owner;
		uint256 pricePerNight;
		bool isActive;
		string propertyURI;
	}
	
	// Mapping of propertyId to Property
	mapping(string => Property) public properties;
	
	// Array to keep track of all property IDs
	string[] public propertyIds;
	
	// Events
	event PropertyListed(string propertyId, address tokenAddress, address owner);
	event PropertyUpdated(string propertyId, uint256 newPricePerNight, bool isActive);
	event PropertyRemoved(string propertyId);
	event PlatformFeeUpdated(uint16 newFeePercentage);
	event FeeRecipientUpdated(address newFeeRecipient);
	
	/**
	 * @dev Constructor sets the platform fee recipient and trusted forwarder
	 */
	constructor(address payable _feeRecipient, address _trustedForwarder)
		Ownable(_msgSender())
		ERC2771Context(_trustedForwarder)
	{
		feeRecipient = _feeRecipient;
	}
	
	/**
	 * @dev Creates a new property listing and tokenizes it
	 * @param _propertyURI IPFS URI containing property details
	 * @param _pricePerNight Price per night in wei
	 * @param _tokenName Name for the property token
	 * @param _tokenSymbol Symbol for the property token
	 */
	function listProperty(
		string memory _propertyURI,
		uint256 _pricePerNight,
		string memory _tokenName,
		string memory _tokenSymbol
	) external returns (string memory) {
		// Resolve sender (original user if via forwarder)
		address sender = _msgSender();

		// Generate a unique property ID
		_propertyIdCounter++;
		string memory propertyId = string(abi.encodePacked("PROP", _toString(_propertyIdCounter)));
		
		// Create a new property token
		PropertyToken propertyToken = new PropertyToken(
			propertyId,
			_propertyURI,
			_tokenName,
			_tokenSymbol,
			sender
		);
		
		// Store property details
		properties[propertyId] = Property({
			propertyId: propertyId,
			propertyTokenAddress: address(propertyToken),
			owner: sender,
			pricePerNight: _pricePerNight,
			isActive: true,
			propertyURI: _propertyURI
		});
		
		// Add property ID to the array
		propertyIds.push(propertyId);
		
		// Emit event
		emit PropertyListed(propertyId, address(propertyToken), sender);
		
		return propertyId;
	}
	
	/**
	 * @dev Updates a property's price and status
	 * @param _propertyId ID of the property to update
	 * @param _pricePerNight New price per night in wei
	 * @param _isActive Whether the property is available for booking
	 */
	function updateProperty(
		string memory _propertyId,
		uint256 _pricePerNight,
		bool _isActive
	) external {
		// Verify property exists and caller is the owner
		require(properties[_propertyId].owner == _msgSender(), "Not property owner");
		
		// Update property details
		properties[_propertyId].pricePerNight = _pricePerNight;
		properties[_propertyId].isActive = _isActive;
		
		// Emit event
		emit PropertyUpdated(_propertyId, _pricePerNight, _isActive);
	}
	
	/**
	 * @dev Removes a property from active listings
	 * @param _propertyId ID of the property to remove
	 */
	function removeProperty(string memory _propertyId) external {
		// Verify property exists and caller is the owner
		require(properties[_propertyId].owner == _msgSender(), "Not property owner");
		
		// Set property as inactive
		properties[_propertyId].isActive = false;
		
		// Emit event
		emit PropertyRemoved(_propertyId);
	}
	
	/**
	 * @dev Gets all property IDs
	 * @return Array of property IDs
	 */
	function getAllPropertyIds() external view returns (string[] memory) {
		return propertyIds;
	}
	
	/**
	 * @dev Gets active property IDs
	 * @return Array of active property IDs
	 */
	function getActivePropertyIds() external view returns (string[] memory) {
		// Count active properties
		uint256 activeCount = 0;
		for (uint256 i = 0; i < propertyIds.length; i++) {
			if (properties[propertyIds[i]].isActive) {
				activeCount++;
			}
		}
		
		// Create array of active property IDs
		string[] memory activePropertyIds = new string[](activeCount);
		uint256 index = 0;
		for (uint256 i = 0; i < propertyIds.length; i++) {
			if (properties[propertyIds[i]].isActive) {
				activePropertyIds[index] = propertyIds[i];
				index++;
			}
		}
		
		return activePropertyIds;
	}
	
	/**
	 * @dev Updates the platform fee percentage (owner only)
	 * @param _newFeePercentage New fee percentage (with 1 decimal place, e.g., 30 = 3.0%)
	 */
	function updatePlatformFee(uint16 _newFeePercentage) external onlyOwner {
		// Ensure fee is reasonable (max 10%)
		require(_newFeePercentage <= 100, "Fee too high");
		platformFeePercentage = _newFeePercentage;
		emit PlatformFeeUpdated(_newFeePercentage);
	}
	
	/**
	 * @dev Updates the fee recipient address (owner only)
	 * @param _newFeeRecipient New address to receive platform fees
	 */
	function updateFeeRecipient(address payable _newFeeRecipient) external onlyOwner {
		require(_newFeeRecipient != address(0), "Invalid address");
		feeRecipient = _newFeeRecipient;
		emit FeeRecipientUpdated(_newFeeRecipient);
	}
	
	/**
	 * @dev Helper function to convert uint to string
	 */
	function _toString(uint256 value) internal pure returns (string memory) {
		// Special case for 0
		if (value == 0) {
			return "0";
		}
		
		// Find number of digits
		uint256 temp = value;
		uint256 digits;
		while (temp != 0) {
			digits++;
			temp /= 10;
		}
		
		// Allocate buffer
		bytes memory buffer = new bytes(digits);
		
		// Fill buffer
		while (value != 0) {
			digits -= 1;
			buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
			value /= 10;
		}
		
		return string(buffer);
	}

	// Ensure the correct sender is used by both Ownable and ERC2771Context
	function _msgSender() internal view override(Context, ERC2771Context) returns (address) {
		return ERC2771Context._msgSender();
	}

	function _msgData() internal view override(Context, ERC2771Context) returns (bytes calldata) {
		return ERC2771Context._msgData();
	}

	function _contextSuffixLength() internal view override(Context, ERC2771Context) returns (uint256) {
		return ERC2771Context._contextSuffixLength();
	}
} 