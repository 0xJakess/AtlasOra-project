import React, { useEffect } from 'react';
import styled from 'styled-components';
import { useLocation } from 'react-router-dom';

const Wrapper = styled.div`
  max-width: 600px;
  margin: 60px auto;
  padding: 40px;
  text-align: center;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
`;

const ThankYouPage = () => {
  const location = useLocation();

  useEffect(() => {
    // Clear the listing_search_params from localStorage
    localStorage.removeItem('listing_search_params');
  }, []);

  const searchParams = new URLSearchParams(location.search);
  const revolutStatus = searchParams.get('revolut_status') || searchParams.get('status');

  // Check if payment was successful
  const isSuccess = revolutStatus &&
    (revolutStatus.toLowerCase() === 'success' || revolutStatus.toLowerCase() === 'completed');

  if (!isSuccess) {
    return (
      <Wrapper>
        <h1 style={{ color: '#dc3545' }}>Payment Issue</h1>
        <p>There was an issue with your payment. Please try again or contact support.</p>
      </Wrapper>
    );
  }

  // Payment successful - webhook will create the blockchain booking
  return (
    <Wrapper>
      <h1>Thank You!</h1>
      <p>Your payment was successful and your booking has been confirmed.</p>
      <p>You'll receive an email with your reservation details shortly.</p>
      <p style={{ marginTop: '20px', fontSize: '14px', color: '#666' }}>
        You can view your bookings in your <a href="/profile/booking">profile</a>.
      </p>
    </Wrapper>
  );
};

export default ThankYouPage;
