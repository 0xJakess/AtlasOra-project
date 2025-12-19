'use strict';

/**
 * Property lifecycle hooks for blockchain synchronization
 *
 * When a property is created or updated in Strapi, these hooks
 * call the backend to sync the property to the blockchain.
 *
 * IMPORTANT:
 * - BlockchainPropertyId updates are handled by the backend's bulk sync
 * - Strapi v5 fires multiple hooks for draft/publish operations
 * - We only want to sync when actual content changes on PUBLISHED entries
 */

const BACKEND_BASE_URL = process.env.BACKEND_BASE_URL || 'http://localhost:3000';
const SYNC_ENABLED = process.env.BLOCKCHAIN_SYNC_ENABLED !== 'false';

// Debounce map to prevent duplicate sync requests
// Key: documentId, Value: { timeout, action, hasBlockchainId }
const pendingSyncs = new Map();
const DEBOUNCE_MS = 5000; // 5 second debounce window

// Fields that should NOT trigger a blockchain sync when changed
const IGNORED_FIELDS = [
	'BlockchainPropertyId',
	'publishedAt',
	'updatedAt',
	'createdAt',
	'localizations',
	'locale',
	'updatedBy',
	'createdBy',
];

/**
 * Call the backend to sync a property to blockchain
 */
async function syncPropertyToBlockchain(documentId, hasBlockchainId) {
	if (!SYNC_ENABLED) {
		console.log(`[Property Lifecycle] Blockchain sync disabled`);
		return;
	}

	if (!documentId) {
		console.warn(`[Property Lifecycle] No documentId provided`);
		return;
	}

	// Determine action based on whether property already has blockchain ID
	const action = hasBlockchainId ? 'update' : 'create';
	const endpoint = hasBlockchainId
		? `${BACKEND_BASE_URL}/api/properties/sync/update`
		: `${BACKEND_BASE_URL}/api/properties/sync/new`;

	try {
		console.log(`[Property Lifecycle] Triggering blockchain ${action} for property ${documentId}`);

		const response = await fetch(endpoint, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				propertyId: documentId,
				action,
			}),
		});

		if (!response.ok) {
			const error = await response.json().catch(() => ({}));
			console.error(`[Property Lifecycle] Blockchain sync failed:`, error);
		} else {
			const syncResult = await response.json();
			console.log(`[Property Lifecycle] Blockchain sync result:`, syncResult);
		}
	} catch (error) {
		console.error(`[Property Lifecycle] Error syncing to blockchain:`, error.message);
	}
}

/**
 * Schedule a sync with debouncing
 */
function scheduleSync(documentId, hasBlockchainId) {
	// Clear any existing pending sync for this document
	if (pendingSyncs.has(documentId)) {
		const existing = pendingSyncs.get(documentId);
		clearTimeout(existing.timeout);
		console.log(`[Property Lifecycle] Replacing pending sync for ${documentId}`);
	}

	// Schedule the sync
	const timeout = setTimeout(() => {
		pendingSyncs.delete(documentId);
		syncPropertyToBlockchain(documentId, hasBlockchainId);
	}, DEBOUNCE_MS);

	pendingSyncs.set(documentId, { timeout, hasBlockchainId });

	const action = hasBlockchainId ? 'update' : 'create';
	console.log(`[Property Lifecycle] Scheduled ${action} sync for ${documentId} in ${DEBOUNCE_MS}ms`);
}

module.exports = {
	// afterCreate: Fires for new properties AND when publishing updates in Strapi v5
	async afterCreate(event) {
		const { result } = event;
		const documentId = result?.documentId;
		const hasBlockchainId = !!result?.BlockchainPropertyId;

		console.log(`[Property Lifecycle] afterCreate: ${documentId}, hasBlockchainId: ${hasBlockchainId}, publishedAt: ${result?.publishedAt}`);

		// Only sync if it's published
		if (!result?.publishedAt) {
			console.log(`[Property Lifecycle] Skipping afterCreate - not published`);
			return;
		}

		// Schedule sync - hasBlockchainId determines if it's create or update
		scheduleSync(documentId, hasBlockchainId);
	},

	// afterUpdate: For updates to existing properties
	async afterUpdate(event) {
		const { params, result } = event;
		const documentId = result?.documentId;
		const updatedFields = Object.keys(params?.data || {});
		const hasBlockchainId = !!result?.BlockchainPropertyId;

		console.log(`[Property Lifecycle] afterUpdate: ${documentId}, hasBlockchainId: ${hasBlockchainId}`);

		// Filter out system/ignored fields to find meaningful changes
		const meaningfulFields = updatedFields.filter(f => !IGNORED_FIELDS.includes(f));

		console.log(`[Property Lifecycle] Meaningful fields: ${meaningfulFields.join(', ') || '(none)'}`);

		// Skip if no meaningful fields were updated
		if (meaningfulFields.length === 0) {
			console.log(`[Property Lifecycle] Skipping - no meaningful fields changed`);
			return;
		}

		// Only sync if published
		if (!result?.publishedAt) {
			console.log(`[Property Lifecycle] Skipping - not published`);
			return;
		}

		console.log(`[Property Lifecycle] Will sync changes for: ${meaningfulFields.join(', ')}`);
		scheduleSync(documentId, hasBlockchainId);
	},

	// afterDelete: We don't sync deletes to blockchain (properties stay on-chain)
	async afterDelete(event) {
		console.log(`[Property Lifecycle] afterDelete - not syncing to blockchain`);
	},
};
