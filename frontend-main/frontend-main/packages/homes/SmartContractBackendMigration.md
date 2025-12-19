# Backend Migration & Signature Support Plan

## 1. **Frontend Logic to Move to the Backend**

### a. **Property Listing & Management**
- **Current:**  
	- `PropertyListingForm` collects property data and directly calls the smart contract from the frontend.
- **Backend Migration:**  
	- Move property listing logic to the backend:
		- Backend receives property data from the frontend.
		- Backend prepares the transaction data (e.g., `listProperty` call).
		- Backend returns the unsigned transaction or EIP-712 payload to the frontend for user signature.
		- Backend submits the signed transaction to the blockchain.
	- **Sync property data** between blockchain and CMS DB (e.g., on successful listing, update CMS).

### b. **Booking Properties**
- **Current:**  
	- `BookingForm` collects booking details and sends them directly to the smart contract.
- **Backend Migration:**  
	- Move booking logic to the backend:
		- Backend receives booking request.
		- Backend checks for conflicts, calculates price, and prepares the transaction.
		- Backend returns the unsigned transaction or EIP-712 payload to the frontend for user signature.
		- Backend submits the signed transaction.
	- **Sync booking data** between blockchain and CMS DB.

### c. **Booking Management**
- **Current:**  
	- `BookingManagement` fetches and manages bookings directly from the blockchain.
- **Backend Migration:**  
	- Backend fetches bookings from the blockchain and/or CMS DB.
	- Backend exposes endpoints for:
		- Viewing bookings
		- Triggering check-in, cancellation, dispute, etc.
	- Backend prepares and returns transactions for user signature as needed.

### d. **Wallet/Account Status**
- **Current:**  
	- `WalletStatus` and `useAccount` are used to check wallet connection.
- **Backend Migration:**  
	- Frontend still needs to connect wallet for signing.
	- Backend can verify wallet ownership via signature challenge (optional for login/auth).

---

## 2. **Smart Contract Changes for Signature Support**

### a. **Meta-Transactions / EIP-712**
- **Goal:** Allow backend to prepare transactions, user to sign, backend to submit.
- **Options:**
	- **EIP-712 Typed Data Signatures:**  
		- User signs a structured payload (off-chain).
		- Backend submits the signed payload to a contract function (e.g., `executeMetaTransaction`).
		- Contract verifies the signature and executes the action.
	- **Minimal Approach:**  
		- For simple value transfers (e.g., booking with `msg.value`), you may need to refactor to support meta-tx or permit-style flows.

### b. **Contract Modifications**
- **Add meta-transaction support** (if not already present):
	- Add a function like:
		```solidity
		function executeMetaTransaction(
			address user,
			bytes calldata functionSignature,
			bytes32 r,
			bytes32 s,
			uint8 v
		) public returns (bytes memory);
		```
	- Use OpenZeppelin’s `MinimalForwarder` or similar for relaying.
	- For EIP-712, add domain separator, nonce tracking, and signature verification.

- **For ERC20 (PropertyToken):**
	- Consider adding `permit` (EIP-2612) for approvals via signature.

- **For Booking/Listing:**
	- Refactor functions that require `msg.sender` to accept a `user` parameter and verify signature.

---

## 3. **Frontend Changes**

- **No direct contract calls.**
- All contract interactions go through the backend.
- Frontend:
	- Requests action (e.g., book, list, manage).
	- Receives payload to sign (EIP-712 or raw tx).
	- Signs with wallet.
	- Sends signature back to backend.
	- Backend submits to blockchain and returns result.

---

## 4. **Example Backend API Flow**

### a. **Property Listing**
1. **Frontend:** Sends property data to backend.
2. **Backend:** Prepares `listProperty` tx data, returns EIP-712 payload.
3. **Frontend:** User signs payload.
4. **Frontend:** Sends signature to backend.
5. **Backend:** Verifies signature, submits tx, updates CMS.

### b. **Booking**
1. **Frontend:** Sends booking request to backend.
2. **Backend:** Prepares booking tx, returns EIP-712 payload.
3. **Frontend:** User signs payload.
4. **Frontend:** Sends signature to backend.
5. **Backend:** Verifies, submits, updates CMS.

---

## 5. **Summary Table**

| Functionality         | Move to Backend? | Contract Change Needed? | Signature Flow Needed? |
|----------------------|:----------------:|:----------------------:|:----------------------:|
| Property Listing     |        ✅        |          ✅            |          ✅            |
| Booking              |        ✅        |          ✅            |          ✅            |
| Booking Management   |        ✅        |          ✅ (for actions) |       ✅            |
| Wallet Status        |        ❌        |          ❌            |          ❌            |

---

## 6. **References & Next Steps**

- [OpenZeppelin Defender Meta-Transactions](https://docs.openzeppelin.com/defender/meta-transactions)
- [EIP-712: Typed Structured Data Hashing and Signing](https://eips.ethereum.org/EIPS/eip-712)
- [EIP-2612: permit for ERC20](https://eips.ethereum.org/EIPS/eip-2612)

---

## 7. **Action Items**

1. **Backend**
	- Implement endpoints for property listing, booking, and management.
	- Prepare EIP-712 payloads for user signature.
	- Submit signed transactions to blockchain.
	- Sync blockchain state with CMS DB.

2. **Smart Contracts**
	- Add meta-transaction/EIP-712 support.
	- Refactor functions to accept user address and signature.
	- Add nonce management to prevent replay attacks.

3. **Frontend**
	- Remove direct contract calls.
	- Integrate with backend for all blockchain actions.
	- Implement EIP-712 signing UI.

---

Let me know if you want a more detailed breakdown for any specific contract or API endpoint, or if you want code samples for EIP-712 integration! 