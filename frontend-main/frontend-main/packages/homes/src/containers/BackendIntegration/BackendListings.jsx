import React, { useContext, useMemo } from 'react';
import styled from 'styled-components';
import { AuthContext } from 'context/AuthProvider';
import PropertySelector from 'components/Booking/PropertySelector';

const Page = styled.div`
	max-width: 1000px;
	margin: 40px auto;
	padding: 20px;
`;
const Title = styled.h2`
	margin: 0 0 16px 0;
`;

export default function BackendListings() {
	const { token: userJwt } = useContext(AuthContext);
	const adminBaseUrl = useMemo(() => (import.meta.env.VITE_APP_API_URL || 'http://localhost:1337/api/'), []);
	const adminToken = useMemo(() => import.meta.env.VITE_APP_API_TOKEN || userJwt || '', [userJwt]);

	return (
		<Page>
			<Title>All Properties (Strapi, Demo)</Title>
			<PropertySelector
				useStrapi={true}
				adminBaseUrl={adminBaseUrl}
				adminToken={adminToken}
				cmsUsersByAddress={{}}
				onPropertySelected={() => {}}
			/>
		</Page>
	);
} 