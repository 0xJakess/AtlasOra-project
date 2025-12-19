const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Property Rental System", function () {
	// Test constants
	const PROPERTY_URI = "ipfs://QmT5NP1GHEvQRJA4VpAP3NRojCLn3cWHRqLiobPdVktwSd";
	const PRICE_PER_NIGHT = ethers.parseEther("0.1"); // 0.1 ETH
	const TOKEN_NAME = "Beach House";
	const TOKEN_SYMBOL = "BEACH";
	const ONE_DAY = 24 * 60 * 60; // 1 day in seconds
	
	// Test variables
	let propertyMarketplace;
	let bookingManager;
	let propertyToken;
	let deployer;
	let host;
	let guest;
	let admin;
	let propertyId;
	let bookingId;
	
	before(async function () {
		// Get signers
		[deployer, host, guest, admin] = await ethers.getSigners();
	});
	
	beforeEach(async function () {
		// Deploy PropertyMarketplace
		const PropertyMarketplace = await ethers.getContractFactory("PropertyMarketplace");
		propertyMarketplace = await PropertyMarketplace.deploy(deployer.address);
		
		// Deploy BookingManager
		const BookingManager = await ethers.getContractFactory("BookingManager");
		bookingManager = await BookingManager.connect(deployer).deploy(await propertyMarketplace.getAddress());
		
		// Host lists a property
		const listTx = await propertyMarketplace.connect(host).listProperty(
			PROPERTY_URI,
			PRICE_PER_NIGHT,
			TOKEN_NAME,
			TOKEN_SYMBOL
		);
		
		// Get property ID from event
		const receipt = await listTx.wait();
		const event = receipt.logs.find(log => {
			try {
				return propertyMarketplace.interface.parseLog(log).name === "PropertyListed";
			} catch (e) {
				return false;
			}
		});
		
		if (event) {
			const parsedEvent = propertyMarketplace.interface.parseLog(event);
			propertyId = parsedEvent.args.propertyId;
		}
		
		// Get the token address
		const property = await propertyMarketplace.properties(propertyId);
		
		// Get the PropertyToken contract
		const PropertyToken = await ethers.getContractFactory("PropertyToken");
		propertyToken = PropertyToken.attach(property.propertyTokenAddress);
	});
	
	describe("PropertyMarketplace", function () {
		it("Should create property with correct details", async function () {
			const property = await propertyMarketplace.properties(propertyId);
			
			expect(property.owner).to.equal(host.address);
			expect(property.pricePerNight).to.equal(PRICE_PER_NIGHT);
			expect(property.isActive).to.equal(true);
			expect(property.propertyURI).to.equal(PROPERTY_URI);
		});
		
		it("Should mint 1000 tokens to property creator", async function () {
			const hostBalance = await propertyToken.balanceOf(host.address);
			
			// 1000 tokens * 10^18 (decimals)
			const expectedBalance = ethers.parseUnits("1000", 18);
			expect(hostBalance).to.equal(expectedBalance);
		});
		
		it("Should allow updating property details", async function () {
			const newPrice = ethers.parseEther("0.2");
			
			await propertyMarketplace.connect(host).updateProperty(propertyId, newPrice, true);
			
			const property = await propertyMarketplace.properties(propertyId);
			expect(property.pricePerNight).to.equal(newPrice);
		});
		
		it("Should not allow non-owner to update property", async function () {
			await expect(
				propertyMarketplace.connect(guest).updateProperty(propertyId, PRICE_PER_NIGHT, true)
			).to.be.revertedWith("Not property owner");
		});
	});
	
	describe("BookingManager", function () {
		it("Should create booking with correct payment", async function () {
			// Get current block timestamp
			const latestBlock = await ethers.provider.getBlock("latest");
			const currentTimestamp = latestBlock.timestamp;
			
			// Set check-in and check-out dates
			const checkInDate = currentTimestamp + 2 * ONE_DAY; // 2 days from now
			const checkOutDate = checkInDate + 3 * ONE_DAY; // 3 days stay
			
			// 3 nights * 0.1 ETH = 0.3 ETH
			const bookingAmount = ethers.parseEther("0.3");
			
			const createBookingTx = await bookingManager.connect(guest).createBooking(
				propertyId,
				checkInDate,
				checkOutDate,
				{ value: bookingAmount }
			);
			
			const receipt = await createBookingTx.wait();
			const event = receipt.logs.find(log => {
				try {
					return bookingManager.interface.parseLog(log).name === "BookingCreated";
				} catch (e) {
					return false;
				}
			});
			
			if (event) {
				const parsedEvent = bookingManager.interface.parseLog(event);
				bookingId = parsedEvent.args.bookingId;
			}
			
			const booking = await bookingManager.bookings(bookingId);
			
			expect(booking.propertyId).to.equal(propertyId);
			expect(booking.guest).to.equal(guest.address);
			expect(booking.checkInDate).to.equal(checkInDate);
			expect(booking.checkOutDate).to.equal(checkOutDate);
			expect(booking.totalAmount).to.equal(bookingAmount);
			expect(booking.status).to.equal(0); // Active status
		});
		
		it("Should calculate platform fee correctly (3%)", async function () {
			// Get current block timestamp
			const latestBlock = await ethers.provider.getBlock("latest");
			const currentTimestamp = latestBlock.timestamp;
			
			// Set check-in and check-out dates
			const checkInDate = currentTimestamp + 2 * ONE_DAY; // 2 days from now
			const checkOutDate = checkInDate + 3 * ONE_DAY; // 3 days stay
			
			// 3 nights * 0.1 ETH = 0.3 ETH
			const bookingAmount = ethers.parseEther("0.3");
			const platformFeePercentage = await propertyMarketplace.platformFeePercentage();
			const expectedPlatformFee = ethers.parseEther("0.009"); // 3% of 0.3 ETH
			
			const createBookingTx = await bookingManager.connect(guest).createBooking(
				propertyId,
				checkInDate,
				checkOutDate,
				{ value: bookingAmount }
			);
			
			const receipt = await createBookingTx.wait();
			const event = receipt.logs.find(log => {
				try {
					return bookingManager.interface.parseLog(log).name === "BookingCreated";
				} catch (e) {
					return false;
				}
			});
			
			if (event) {
				const parsedEvent = bookingManager.interface.parseLog(event);
				bookingId = parsedEvent.args.bookingId;
			}
			
			const booking = await bookingManager.bookings(bookingId);
			expect(booking.platformFee).to.equal(expectedPlatformFee);
			expect(booking.hostAmount).to.equal(bookingAmount - expectedPlatformFee);
		});
	});
	
	describe("Check-in Process", function () {
		let checkInDate;
		let checkOutDate;
		
		beforeEach(async function () {
			// Get current block timestamp
			const latestBlock = await ethers.provider.getBlock("latest");
			const currentTimestamp = latestBlock.timestamp;
			
			// Set check-in and check-out dates
			checkInDate = currentTimestamp + 2 * ONE_DAY; // 2 days from now
			checkOutDate = checkInDate + 3 * ONE_DAY; // 3 days stay
			
			// Create a booking first
			// 3 nights * 0.1 ETH = 0.3 ETH
			const bookingAmount = ethers.parseEther("0.3");
			
			const createBookingTx = await bookingManager.connect(guest).createBooking(
				propertyId,
				checkInDate,
				checkOutDate,
				{ value: bookingAmount }
			);
			
			const receipt = await createBookingTx.wait();
			const event = receipt.logs.find(log => {
				try {
					return bookingManager.interface.parseLog(log).name === "BookingCreated";
				} catch (e) {
					return false;
				}
			});
			
			if (event) {
				const parsedEvent = bookingManager.interface.parseLog(event);
				bookingId = parsedEvent.args.bookingId;
			}
		});
		
		it("Should trigger check-in window when check-in date is reached", async function () {
			// Fast forward to check-in date
			await ethers.provider.send("evm_setNextBlockTimestamp", [checkInDate]);
			await ethers.provider.send("evm_mine");
			
			await bookingManager.triggerCheckInWindow(bookingId);
			
			const booking = await bookingManager.bookings(bookingId);
			expect(booking.status).to.equal(1); // CheckInReady status
			expect(booking.checkInWindowStart).to.be.gt(0);
			expect(booking.checkInDeadline).to.be.gt(booking.checkInWindowStart);
		});
		
		it("Should allow guest to check in during window", async function () {
			// Fast forward to check-in date
			await ethers.provider.send("evm_setNextBlockTimestamp", [checkInDate]);
			await ethers.provider.send("evm_mine");
			
			await bookingManager.triggerCheckInWindow(bookingId);
			
			// Guest checks in
			await bookingManager.connect(guest).checkIn(bookingId);
			
			const booking = await bookingManager.bookings(bookingId);
			expect(booking.status).to.equal(2); // CheckedIn status
			expect(booking.isCheckInComplete).to.equal(true);
		});
		
		it("Should handle missed check-in and dispute process", async function () {
			// Fast forward to check-in date
			await ethers.provider.send("evm_setNextBlockTimestamp", [checkInDate]);
			await ethers.provider.send("evm_mine");
			
			await bookingManager.triggerCheckInWindow(bookingId);
			
			// Fast forward past check-in window
			const booking = await bookingManager.bookings(bookingId);
			await ethers.provider.send("evm_setNextBlockTimestamp", [Number(booking.checkInDeadline) + 1]);
			await ethers.provider.send("evm_mine");
			
			// Process missed check-in
			await bookingManager.processMissedCheckIn(bookingId);
			
			const disputedBooking = await bookingManager.bookings(bookingId);
			expect(disputedBooking.status).to.equal(4); // Disputed status
			expect(disputedBooking.disputeDeadline).to.be.gt(0);
			expect(disputedBooking.disputeReason).to.equal("Missed check-in");
		});
		
		it("Should resolve dispute when both parties agree", async function () {
			// Fast forward to check-in date
			await ethers.provider.send("evm_setNextBlockTimestamp", [checkInDate]);
			await ethers.provider.send("evm_mine");
			
			await bookingManager.triggerCheckInWindow(bookingId);
			
			// Fast forward past check-in window
			const booking = await bookingManager.bookings(bookingId);
			await ethers.provider.send("evm_setNextBlockTimestamp", [Number(booking.checkInDeadline) + 1]);
			await ethers.provider.send("evm_mine");
			
			// Process missed check-in
			await bookingManager.processMissedCheckIn(bookingId);
			
			// Both parties resolve the dispute
			await bookingManager.connect(host).hostResolveDispute(bookingId);
			await bookingManager.connect(guest).guestResolveDispute(bookingId);
			
			const resolvedBooking = await bookingManager.bookings(bookingId);
			expect(resolvedBooking.status).to.equal(3); // Completed status
		});
		
		it("Should escalate dispute to admin when deadline expires", async function () {
			// Fast forward to check-in date
			await ethers.provider.send("evm_setNextBlockTimestamp", [checkInDate]);
			await ethers.provider.send("evm_mine");
			
			await bookingManager.triggerCheckInWindow(bookingId);
			
			// Fast forward past check-in window
			const booking = await bookingManager.bookings(bookingId);
			await ethers.provider.send("evm_setNextBlockTimestamp", [Number(booking.checkInDeadline) + 1]);
			await ethers.provider.send("evm_mine");
			
			// Process missed check-in
			await bookingManager.processMissedCheckIn(bookingId);
			
			// Fast forward past dispute resolution window
			const disputedBooking = await bookingManager.bookings(bookingId);
			await ethers.provider.send("evm_setNextBlockTimestamp", [Number(disputedBooking.disputeDeadline) + 1]);
			await ethers.provider.send("evm_mine");
			
			// Escalate to admin
			await bookingManager.escalateDispute(bookingId);
			
			const escalatedBooking = await bookingManager.bookings(bookingId);
			expect(escalatedBooking.status).to.equal(7); // EscalatedToAdmin status
		});
	});
}); 