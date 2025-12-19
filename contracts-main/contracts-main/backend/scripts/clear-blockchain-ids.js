/**
 * Script to clear BlockchainPropertyId from all properties in Strapi
 * Run this after redeploying contracts to resync properties to the new blockchain
 *
 * Usage: node scripts/clear-blockchain-ids.js
 */

require('dotenv').config();

const STRAPI_BASE_URL = process.env.STRAPI_BASE_URL || 'http://localhost:1337';
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN;

async function clearBlockchainIds() {
	console.log('🔧 Clearing BlockchainPropertyId from all properties...\n');

	if (!STRAPI_API_TOKEN) {
		console.error('❌ STRAPI_API_TOKEN is not set');
		process.exit(1);
	}

	// Fetch all properties
	const response = await fetch(`${STRAPI_BASE_URL}/api/properties?pagination[pageSize]=100`, {
		headers: {
			'Authorization': `Bearer ${STRAPI_API_TOKEN}`,
		},
	});

	if (!response.ok) {
		console.error('❌ Failed to fetch properties:', response.status);
		process.exit(1);
	}

	const data = await response.json();
	const properties = data.data || [];

	console.log(`📊 Found ${properties.length} properties\n`);

	let cleared = 0;
	let skipped = 0;

	for (const property of properties) {
		const documentId = property.documentId || property.id;
		const title = property.Title || property.attributes?.Title || 'Unknown';
		const blockchainId = property.BlockchainPropertyId || property.attributes?.BlockchainPropertyId;

		if (!blockchainId) {
			console.log(`  ⏭️ ${title} - no BlockchainPropertyId`);
			skipped++;
			continue;
		}

		console.log(`  🗑️ Clearing ${title} (was: ${blockchainId})...`);

		const updateResponse = await fetch(`${STRAPI_BASE_URL}/api/properties/${documentId}`, {
			method: 'PUT',
			headers: {
				'Authorization': `Bearer ${STRAPI_API_TOKEN}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				data: {
					BlockchainPropertyId: null,
				},
			}),
		});

		if (updateResponse.ok) {
			console.log(`     ✅ Cleared`);
			cleared++;
		} else {
			const error = await updateResponse.json().catch(() => ({}));
			console.log(`     ❌ Failed: ${JSON.stringify(error)}`);
		}
	}

	console.log('\n📊 Summary:');
	console.log(`   ✅ Cleared: ${cleared}`);
	console.log(`   ⏭️ Skipped: ${skipped}`);
	console.log('\n🔄 Run bulk sync to re-sync properties to the new blockchain');
}

clearBlockchainIds().catch(error => {
	console.error('Error:', error);
	process.exit(1);
});
