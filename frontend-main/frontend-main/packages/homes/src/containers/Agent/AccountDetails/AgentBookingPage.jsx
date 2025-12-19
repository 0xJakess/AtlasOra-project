import React, { useContext, useEffect, useState } from 'react';
import { AuthContext } from 'context/AuthProvider';
import useDataApi from 'library/hooks/useDataApi';
import Container from 'components/UI/Container/Container';
import Heading from 'components/UI/Heading/Heading';
import Loader from 'components/Loader/Loader';
import Text from 'components/UI/Text/Text';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';

const BookingCard = styled.div`
  padding: 20px;
  margin-bottom: 20px;
  border: 1px solid #eee;
  border-radius: 12px;
  background: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
`;

const BookingHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
`;

const PropertyTitle = styled.h4`
  margin: 0 0 4px 0;
  font-size: 18px;
  color: #2c2c2c;
`;

const StatusBadge = styled.span`
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  background: ${props => {
    switch (props.status) {
      case 'Confirmed': return '#e3f2fd';
      case 'Pending': return '#fff3e0';
      case 'Cancelled': return '#ffebee';
      case 'Complete': return '#e8f5e9';
      default: return '#f5f5f5';
    }
  }};
  color: ${props => {
    switch (props.status) {
      case 'Confirmed': return '#1976d2';
      case 'Pending': return '#f57c00';
      case 'Cancelled': return '#d32f2f';
      case 'Complete': return '#388e3c';
      default: return '#666';
    }
  }};
`;

const BookingDetails = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
`;

const DetailItem = styled.div`
  font-size: 14px;
  color: #666;

  strong {
    color: #2c2c2c;
  }
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #eee;
`;

const Button = styled.button`
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;

  &:hover:not(:disabled) {
    transform: translateY(-1px);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const PrimaryButton = styled(Button)`
  background: linear-gradient(135deg, #F18881 0%, #FBC82F 100%);
  color: white;
`;

const SecondaryButton = styled(Button)`
  background: #f5f5f5;
  color: #333;

  &:hover:not(:disabled) {
    background: #eee;
  }
`;

const DangerButton = styled(Button)`
  background: #ffebee;
  color: #d32f2f;

  &:hover:not(:disabled) {
    background: #ffcdd2;
  }
`;

const InfoBox = styled.div`
  background: #e3f2fd;
  border: 1px solid #90caf9;
  border-radius: 8px;
  padding: 12px 16px;
  margin-top: 12px;
  font-size: 14px;
  color: #1565c0;
`;

const SuccessMessage = styled.div`
  background: #e8f5e9;
  border: 1px solid #a5d6a7;
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 20px;
  color: #2e7d32;
`;

const ErrorMessage = styled.div`
  background: #ffebee;
  border: 1px solid #ef9a9a;
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 20px;
  color: #c62828;
`;

const AgentBookingPage = () => {
  const { loggedIn, user: userInfo } = useContext(AuthContext);
  const navigate = useNavigate();
  const [actionLoading, setActionLoading] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const backendBaseUrl = import.meta.env.VITE_BACKEND_BASE_URL || 'http://localhost:3000';

  useEffect(() => {
    if (!loggedIn) {
      navigate('/sign-in');
    }
  }, [loggedIn, navigate]);

  const { data: bookingsData, loading: bookingsLoading, refetch } = useDataApi(
    `${import.meta.env.VITE_APP_API_URL}proeprty-bookings?filters[users_permissions_user][id][$eq]=${userInfo?.id}&populate[property][populate]=currency&sort=createdAt:desc`,
    import.meta.env.VITE_APP_API_TOKEN,
    50,
    'proeprty-bookings',
    [],
  );

  // Check if booking is ready for check-in (check-in date has passed)
  const canCheckIn = (booking) => {
    if (!booking.StartDate) return false;
    const checkInDate = new Date(booking.StartDate);
    const now = new Date();
    // Can check in if we're past the check-in date and booking is confirmed
    return now >= checkInDate && booking.BookingStatus === 'Confirmed';
  };

  // Check if booking can be cancelled (before check-in date)
  const canCancel = (booking) => {
    if (!booking.StartDate) return false;
    const checkInDate = new Date(booking.StartDate);
    const now = new Date();
    return now < checkInDate && booking.BookingStatus === 'Confirmed';
  };

  const handleCheckIn = async (booking) => {
    if (!booking.blockchainBookingId) {
      setErrorMsg('This booking does not have a blockchain record. Check-in not available.');
      return;
    }

    setActionLoading(booking.id);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const response = await fetch(`${backendBaseUrl}/api/bookings/check-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: booking.blockchainBookingId,
          userId: userInfo?.id,
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setSuccessMsg(`Check-in successful! You're all set for your stay.`);
        // Refresh bookings
        setTimeout(() => refetch(), 2000);
      } else {
        setErrorMsg(result.error || 'Check-in failed. Please try again.');
      }
    } catch (error) {
      console.error('Check-in error:', error);
      setErrorMsg('Network error. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancelBooking = async (booking) => {
    if (!confirm('Are you sure you want to cancel this booking?')) return;

    setActionLoading(booking.id);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      // If has blockchain record, cancel on-chain
      if (booking.blockchainBookingId) {
        const response = await fetch(`${backendBaseUrl}/api/bookings/cancel`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bookingId: booking.blockchainBookingId,
            userId: userInfo?.id,
          }),
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          setErrorMsg(result.error || 'Cancellation failed.');
          return;
        }
      }

      // Update CMS status
      await fetch(`${import.meta.env.VITE_APP_API_URL}proeprty-bookings/${booking.documentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_APP_API_TOKEN}`,
        },
        body: JSON.stringify({
          data: { BookingStatus: 'Cancelled' },
        }),
      });

      setSuccessMsg('Booking cancelled successfully.');
      setTimeout(() => refetch(), 1000);
    } catch (error) {
      console.error('Cancel error:', error);
      setErrorMsg('Failed to cancel booking. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  if (!loggedIn) return null;
  if (bookingsLoading) return <Loader />;

  return (
    <Container>
      <Heading as="h3" content="Your Bookings" />

      {successMsg && <SuccessMessage>{successMsg}</SuccessMessage>}
      {errorMsg && <ErrorMessage>{errorMsg}</ErrorMessage>}

      {Array.isArray(bookingsData) && bookingsData.length ? (
        bookingsData.map((booking) => {
          const {
            id,
            documentId,
            StartDate,
            EndDate,
            Guests,
            Rooms,
            PaidBy,
            TotalPaid,
            BookingStatus,
            blockchainBookingId, // lowercase from event listener
            property,
          } = booking;
          const currencySymbol = property?.currency?.symbol || '€';
          const isLoading = actionLoading === id;

          return (
            <BookingCard key={id}>
              <BookingHeader>
                <div>
                  <PropertyTitle>{property?.Title || 'Untitled Property'}</PropertyTitle>
                  {blockchainBookingId && (
                    <span style={{ fontSize: 12, color: '#666' }}>
                      Booking #{blockchainBookingId}
                    </span>
                  )}
                </div>
                <StatusBadge status={BookingStatus}>
                  {BookingStatus || 'Pending'}
                </StatusBadge>
              </BookingHeader>

              <BookingDetails>
                <DetailItem>
                  <strong>Check-in:</strong> {StartDate}
                </DetailItem>
                <DetailItem>
                  <strong>Check-out:</strong> {EndDate}
                </DetailItem>
                <DetailItem>
                  <strong>Guests:</strong> {Guests}
                </DetailItem>
                <DetailItem>
                  <strong>Rooms:</strong> {Rooms}
                </DetailItem>
                <DetailItem>
                  <strong>Payment:</strong> {PaidBy}
                </DetailItem>
                <DetailItem>
                  <strong>Total:</strong> {currencySymbol}{TotalPaid}
                </DetailItem>
              </BookingDetails>

              {canCheckIn(booking) && blockchainBookingId && (
                <InfoBox>
                  Your check-in date has arrived! Click "Check In" to confirm your arrival and release payment to the host.
                </InfoBox>
              )}

              <ActionButtons>
                {canCheckIn(booking) && blockchainBookingId && (
                  <PrimaryButton
                    onClick={() => handleCheckIn(booking)}
                    disabled={isLoading}
                  >
                    {isLoading ? 'Processing...' : '✓ Check In'}
                  </PrimaryButton>
                )}

                {canCancel(booking) && (
                  <DangerButton
                    onClick={() => handleCancelBooking(booking)}
                    disabled={isLoading}
                  >
                    {isLoading ? 'Processing...' : '✕ Cancel Booking'}
                  </DangerButton>
                )}

                {BookingStatus === 'Complete' && (
                  <SecondaryButton disabled>
                    ✓ Completed
                  </SecondaryButton>
                )}

                {BookingStatus === 'Cancelled' && (
                  <SecondaryButton disabled>
                    Cancelled
                  </SecondaryButton>
                )}
              </ActionButtons>
            </BookingCard>
          );
        })
      ) : (
        <Text content="You have no bookings yet." />
      )}
    </Container>
  );
};

export default AgentBookingPage;
