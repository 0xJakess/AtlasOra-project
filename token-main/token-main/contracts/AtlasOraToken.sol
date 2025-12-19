// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title AtlasOra Token
 * @dev An ERC20 token with an emission schedule for Base network
 *
 * Features:
 * - Standard ERC20 functionality
 * - Burnable tokens
 * - Scheduled emission to foundation address
 * - Maximum supply cap of 200,000,000 tokens
 * - Burned tokens do not affect emission schedule
 *
 * Emission Schedule:
 * - Deployment: 15% (30,000,000 tokens) - minted to deployer
 * - Cycles 1-8: 10% each (20,000,000 tokens per cycle) - every 6 months
 * - Cycle 9: 5% (10,000,000 tokens) - final emission
 * - Total: 100% (200,000,000 tokens maximum)
 *
 * Security considerations:
 * - Uses OpenZeppelin's audited contracts
 * - Owner-only minting with time-based restrictions
 * - Immutable maximum supply
 * - Foundation address set at deployment
 */
contract AtlasOraToken is ERC20, ERC20Burnable, Ownable {
    // Constants
    uint8 private constant DECIMALS = 18;
    uint256 public constant MAX_SUPPLY = 200_000_000 * 10**18; // 200M tokens
    uint256 public constant EMISSION_INTERVAL = 180 days; // 6 months

    // Emission percentages (in basis points: 1% = 100)
    uint256 private constant INITIAL_EMISSION_PCT = 1500; // 15%
    uint256 private constant REGULAR_EMISSION_PCT = 1000; // 10%
    uint256 private constant FINAL_EMISSION_PCT = 500; // 5%
    uint256 private constant BASIS_POINTS = 10000; // 100%

    // State variables
    address public immutable foundationAddress;
    uint256 public immutable deploymentTimestamp;
    uint256 public totalMinted; // Total tokens ever minted (excluding burns)
    uint8 public currentCycle; // Current emission cycle (0 = deployment, 1-9 = scheduled emissions)

    // Events
    event EmissionMinted(
        uint8 indexed cycle,
        address indexed to,
        uint256 amount,
        uint256 timestamp
    );

    /**
     * @dev Constructor that sets up the token with emission schedule
     * @param name_ Token name
     * @param symbol_ Token symbol
     * @param initialOwner_ Address that will own the contract
     * @param foundationAddress_ Address that receives emission tokens
     */
    constructor(
        string memory name_,
        string memory symbol_,
        address initialOwner_,
        address foundationAddress_
    ) ERC20(name_, symbol_) Ownable(initialOwner_) {
        require(foundationAddress_ != address(0), "Invalid foundation address");

        foundationAddress = foundationAddress_;
        deploymentTimestamp = block.timestamp;
        currentCycle = 0;

        // Mint initial 15% to deployer
        uint256 initialSupply = (MAX_SUPPLY * INITIAL_EMISSION_PCT) / BASIS_POINTS;
        totalMinted = initialSupply;

        _mint(initialOwner_, initialSupply);

        emit EmissionMinted(0, initialOwner_, initialSupply, block.timestamp);
    }

    /**
     * @dev Returns the number of decimals (always 18)
     */
    function decimals() public pure override returns (uint8) {
        return DECIMALS;
    }

    /**
     * @dev Mints tokens according to the emission schedule
     *
     * Emission Schedule:
     * - Cycle 1-8: 10% of MAX_SUPPLY each, available every 6 months
     * - Cycle 9: 5% of MAX_SUPPLY, final emission
     *
     * Requirements:
     * - Can only be called by owner
     * - Sufficient time must have passed since deployment
     * - Cannot exceed maximum supply cap
     * - Tokens always minted to foundation address
     * - Must mint cycles sequentially (cannot skip cycles)
     *
     * Note: Burned tokens do not affect emission amounts
     */
    function mint() external onlyOwner {
        require(currentCycle < 9, "All emissions completed");

        // Calculate which cycle we should be in based on time
        uint256 timeElapsed = block.timestamp - deploymentTimestamp;
        uint8 targetCycle = uint8(timeElapsed / EMISSION_INTERVAL);

        // Ensure at least one interval has passed since deployment
        require(targetCycle > 0, "Next emission not yet available");

        // Must advance to the next cycle sequentially
        require(currentCycle < targetCycle, "Next emission not yet available");
        require(targetCycle <= 9, "Invalid cycle");

        // Move to next cycle (sequential increment only)
        currentCycle++;

        // Calculate emission amount
        uint256 emissionAmount;
        if (currentCycle == 9) {
            // Final cycle: 5%
            emissionAmount = (MAX_SUPPLY * FINAL_EMISSION_PCT) / BASIS_POINTS;
        } else {
            // Cycles 1-8: 10% each
            emissionAmount = (MAX_SUPPLY * REGULAR_EMISSION_PCT) / BASIS_POINTS;
        }

        // Ensure we don't exceed max supply
        require(
            totalMinted + emissionAmount <= MAX_SUPPLY,
            "Emission would exceed max supply"
        );

        totalMinted += emissionAmount;

        _mint(foundationAddress, emissionAmount);

        emit EmissionMinted(
            currentCycle,
            foundationAddress,
            emissionAmount,
            block.timestamp
        );
    }

    /**
     * @dev Returns the timestamp when the next emission becomes available
     * @return Timestamp of next emission, or 0 if all emissions are complete
     */
    function nextEmissionTimestamp() external view returns (uint256) {
        if (currentCycle >= 9) {
            return 0; // All emissions complete
        }

        return deploymentTimestamp + ((currentCycle + 1) * EMISSION_INTERVAL);
    }

    /**
     * @dev Returns the amount of the next emission
     * @return Amount of tokens in next emission, or 0 if all emissions complete
     */
    function nextEmissionAmount() external view returns (uint256) {
        if (currentCycle >= 9) {
            return 0; // All emissions complete
        }

        uint8 nextCycle = currentCycle + 1;

        if (nextCycle == 9) {
            return (MAX_SUPPLY * FINAL_EMISSION_PCT) / BASIS_POINTS;
        } else {
            return (MAX_SUPPLY * REGULAR_EMISSION_PCT) / BASIS_POINTS;
        }
    }

    /**
     * @dev Returns the number of tokens remaining to be minted
     * @return Remaining mintable tokens (based on emission schedule, not current supply)
     */
    function remainingMintableSupply() external view returns (uint256) {
        return MAX_SUPPLY - totalMinted;
    }

    /**
     * @dev Returns whether the next emission is currently available
     * @return true if mint() can be called, false otherwise
     */
    function isEmissionAvailable() external view returns (bool) {
        if (currentCycle >= 9) {
            return false;
        }

        uint256 timeElapsed = block.timestamp - deploymentTimestamp;
        if (timeElapsed < EMISSION_INTERVAL) {
            return false;
        }

        uint8 targetCycle = uint8(timeElapsed / EMISSION_INTERVAL);

        return targetCycle > currentCycle && targetCycle <= 9;
    }

    /**
     * @dev Returns detailed emission schedule information
     * @return cycle Current emission cycle
     * @return totalMinted_ Total tokens minted from emission schedule
     * @return totalSupply_ Current circulating supply (after burns)
     * @return remainingEmissions Tokens remaining to be minted
     * @return nextTimestamp When next emission becomes available (0 if complete)
     * @return nextAmount Amount of next emission (0 if complete)
     */
    function getEmissionInfo()
        external
        view
        returns (
            uint8 cycle,
            uint256 totalMinted_,
            uint256 totalSupply_,
            uint256 remainingEmissions,
            uint256 nextTimestamp,
            uint256 nextAmount
        )
    {
        cycle = currentCycle;
        totalMinted_ = totalMinted;
        totalSupply_ = totalSupply();
        remainingEmissions = MAX_SUPPLY - totalMinted;

        if (currentCycle >= 9) {
            nextTimestamp = 0;
            nextAmount = 0;
        } else {
            nextTimestamp = deploymentTimestamp + ((currentCycle + 1) * EMISSION_INTERVAL);

            if (currentCycle + 1 == 9) {
                nextAmount = (MAX_SUPPLY * FINAL_EMISSION_PCT) / BASIS_POINTS;
            } else {
                nextAmount = (MAX_SUPPLY * REGULAR_EMISSION_PCT) / BASIS_POINTS;
            }
        }
    }
}
