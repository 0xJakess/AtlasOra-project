import React, { useEffect, useContext, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { Button, Divider, Modal, Spin, message } from 'antd';
import { CopyOutlined, CheckCircleOutlined, LoadingOutlined } from '@ant-design/icons';
import moment from 'moment';
import useDataApi from 'library/hooks/useDataApi';
import resolveURL from 'library/helpers/resolveURL';
import { AuthContext } from 'context/AuthProvider';
import formatPrice from 'library/helpers/formatPrice';

const PageWrapper = styled.div`
  max-width: 800px;
  margin: 40px auto;
  padding: 20px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
`;

const Section = styled.div`
  margin-bottom: 32px;
`;

const SummaryBox = styled.div`
  background: #fafafa;
  padding: 16px;
  border: 1px solid #eee;
  border-radius: 8px;
`;

const CryptoPaymentBox = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 16px;
  padding: 20px;
`;

const QRCodeContainer = styled.div`
  background: white;
  padding: 16px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
`;

const AddressBox = styled.div`
  background: #f5f5f5;
  padding: 12px 16px;
  border-radius: 8px;
  font-family: monospace;
  word-break: break-all;
  font-size: 12px;
  max-width: 320px;
`;

const AmountBox = styled.div`
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 16px 24px;
  border-radius: 12px;
  text-align: center;
`;

const StatusBadge = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 20px;
  font-weight: 500;
  background: ${props => {
    switch (props.status) {
      case 'pending': return '#fff7e6';
      case 'confirming': return '#e6f7ff';
      case 'completed': return '#f6ffed';
      case 'expired': return '#fff1f0';
      default: return '#f5f5f5';
    }
  }};
  color: ${props => {
    switch (props.status) {
      case 'pending': return '#d48806';
      case 'confirming': return '#1890ff';
      case 'completed': return '#52c41a';
      case 'expired': return '#f5222d';
      default: return '#666';
    }
  }};
`;

const PaymentPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { loggedIn, user } = useContext(AuthContext);

  // EURC payment state
  const [eurcModalOpen, setEurcModalOpen] = useState(false);
  const [eurcPayment, setEurcPayment] = useState(null);
  const [eurcLoading, setEurcLoading] = useState(false);
  const [eurcStatus, setEurcStatus] = useState(null);
  const [eurcPollingInterval, setEurcPollingInterval] = useState(null);

  const searchParams = new URLSearchParams(location.search);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const guest = searchParams.get('guest');
  const room = searchParams.get('room');
  const slug = searchParams.get('slug');
  const propertyId = searchParams.get('propertyId');
  const deslug = slug ? slug.replace(/-/g, ' ') : '';
  const backendBaseUrl = import.meta.env.VITE_BACKEND_BASE_URL || '';
  const paymentsServerUrl = import.meta.env.VITE_PAYMENTS_SERVER_URL || backendBaseUrl;
  const revolutStatusParam = searchParams.get('revolut_status') || searchParams.get('status');

  const propertiesUrl = `${import.meta.env.VITE_APP_API_URL}properties?filters[$or][0][documentId][$eq]=${encodeURIComponent(
    propertyId || ''
  )}&filters[$or][1][Title][$eqi]=${encodeURIComponent(
    deslug
  )}&populate[Images]=true&populate[currency]=true`;

  const { data, loading } = useDataApi(
    propertiesUrl,
    import.meta.env.VITE_APP_API_TOKEN,
    10,
    'properties',
    [],
    true,
  );

  useEffect(() => {
    if (!loggedIn) {
      const fullPath = window.location.pathname + window.location.search;
      localStorage.setItem('returnTo', fullPath);
      navigate('/sign-in', { replace: true });
    }
  }, [loggedIn, navigate]);



  // Clean up EURC polling on unmount
  useEffect(() => {
    return () => {
      if (eurcPollingInterval) {
        clearInterval(eurcPollingInterval);
      }
    };
  }, [eurcPollingInterval]);

  if (!loggedIn) {
    return null;
  }
  if (loading || !data || !Array.isArray(data) || data.length === 0) {
    if (revolutStatusParam) {
      return (
        <PageWrapper>
          <h2>Processing payment…</h2>
          <p>Please wait while we confirm your booking.</p>
        </PageWrapper>
      );
    }
    return null;
  }

  const raw = data[0];
  const title = raw.Title;
  const price = raw.PricePerNight;
  const gallery = raw.Images || [];
  const homeImage = gallery[0]?.url;
  console.log('Property Currency Data:', raw.currency);
  const currency = 'USD'; // Force USD for debugging, was: raw.currency?.code || 'USD';
  const atlasfees = raw.AtlasFees || 0;
  const cleaningfee = raw.CleaningFee || 0;

  const nights =
    startDate && endDate
      ? moment(endDate, 'MM-DD-YYYY').diff(
        moment(startDate, 'MM-DD-YYYY'),
        'days',
      )
      : 0;

  const total = nights * price;
  // AtlasFees is a percentage (e.g., 3 means 3%), not a flat fee
  const feesTotal = total * (atlasfees / 100);
  const totalWithCleaningFee = total + feesTotal + cleaningfee;

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    message.success('Copied to clipboard!');
  };

  // Initialize EURC payment - user sends to their custodial wallet, then booking is created automatically
  const startEURCPayment = async () => {
    if (!user?.id) {
      message.error('Please sign in to continue');
      return;
    }

    if (!Array.isArray(data) || data.length === 0 || !data[0]?.BlockchainPropertyId) {
      message.warning('This property is not available for EURC payment yet. Please use Credit Card.');
      return;
    }

    setEurcLoading(true);
    setEurcModalOpen(true);
    setEurcStatus('initializing');

    try {
      const prop = data[0];
      const blockchainPropertyId = prop.BlockchainPropertyId;

      // Total in EURC (6 decimals) - prices are in EUR which matches EURC 1:1
      const totalEURC = totalWithCleaningFee;
      const totalEURCBase = BigInt(Math.floor(totalEURC * 1e6)).toString();

      const checkInTs = Math.floor(moment(startDate, 'MM-DD-YYYY').valueOf() / 1000);
      const checkOutTs = Math.floor(moment(endDate, 'MM-DD-YYYY').valueOf() / 1000);

      // Initialize EURC payment session - get unique payment address
      const res = await fetch(`${backendBaseUrl}/api/payments/eurc/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          propertyId: blockchainPropertyId,
          checkInDate: checkInTs,
          checkOutDate: checkOutTs,
          totalAmountEURC: totalEURCBase,
          metadata: {
            propertyTitle: prop.Title,
            cmsPropertyId: prop.documentId,
            guests: parseInt(guest),
            rooms: parseInt(room),
            pricePerNight: price,
            atlasFee: atlasfees,
            cleaningFee: cleaningfee,
            nights: nights,
          },
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to initialize EURC payment');
      }

      const payment = await res.json();
      setEurcPayment(payment);
      setEurcStatus('pending');

      // Start polling for payment status
      const interval = setInterval(() => {
        pollEURCPaymentStatus(payment.paymentId);
      }, 5000);
      setEurcPollingInterval(interval);

    } catch (error) {
      console.error('EURC payment init error:', error);
      message.error(error.message || 'Failed to initialize EURC payment');
      setEurcStatus('error');
    } finally {
      setEurcLoading(false);
    }
  };

  // Poll for EURC payment status
  const pollEURCPaymentStatus = async (paymentId) => {
    try {
      const res = await fetch(`${backendBaseUrl}/api/payments/crypto/status/${paymentId}`);
      if (!res.ok) return;

      const status = await res.json();

      if (status.status === 'completed') {
        // Payment confirmed! Backend has already created the on-chain booking and CMS record
        if (eurcPollingInterval) {
          clearInterval(eurcPollingInterval);
          setEurcPollingInterval(null);
        }

        setEurcStatus('completed');
        message.success('Booking confirmed!');

        setTimeout(() => {
          setEurcModalOpen(false);
          navigate('/thank-you');
        }, 1500);
      } else if (status.status === 'expired') {
        if (eurcPollingInterval) {
          clearInterval(eurcPollingInterval);
          setEurcPollingInterval(null);
        }
        setEurcStatus('expired');
        message.warning('Payment session expired. Please try again.');
      } else if (status.status === 'confirming') {
        setEurcStatus('confirming');
      }
    } catch (error) {
      console.error('Error polling EURC payment status:', error);
    }
  };

  const closeEurcModal = () => {
    if (eurcPollingInterval) {
      clearInterval(eurcPollingInterval);
      setEurcPollingInterval(null);
    }
    setEurcModalOpen(false);
    setEurcPayment(null);
    setEurcStatus(null);
  };

  const handlePayment = async (paymentMethod) => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_APP_API_URL}proeprty-bookings`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_APP_API_TOKEN}`,
          },
          body: JSON.stringify({
            data: {
              property: raw.documentId,
              StartDate: moment(startDate).format('YYYY-MM-DD'),
              EndDate: moment(endDate).format('YYYY-MM-DD'),
              Guests: parseInt(guest),
              Rooms: parseInt(room),
              PriceperNight: price,
              NumberOfNights: nights,
              AtlasFee: atlasfees,
              CleaningFee: cleaningfee,
              TotalPaid: totalWithCleaningFee,
              PaidBy: paymentMethod,
            },
          }),
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Booking error:', errorData);
        alert('There was an issue submitting your booking.');
        return;
      }

      navigate('/thank-you');
    } catch (error) {
      console.error('Error submitting booking:', error);
      alert('Failed to complete booking.');
    }
  };

  const startRevolutHostedCheckout = async () => {
    try {
      if (!backendBaseUrl) {
        alert('Backend URL not configured. Please set VITE_BACKEND_BASE_URL');
        return;
      }
      // Require property data to avoid bad propertyId (e.g., 'disconnect')
      if (!Array.isArray(data) || data.length === 0 || !data[0]?.documentId) {
        alert('Loading property details, please try again in a moment.');
        return;
      }
      const propIdForCheckout = data[0].documentId;

      const successUrl = `${window.location.origin}/thank-you?${new URLSearchParams({
        startDate,
        endDate,
        guest,
        room,
        propertyId: propIdForCheckout,
        slug,
        revolut_status: 'success',
      }).toString()}`;
      console.log('[Payment] Generated successUrl:', successUrl);
      const cancelUrl = `${window.location.href}`;
      console.debug('[payments] starting Revolut checkout', { endpoint: `${paymentsServerUrl}/payments/revolut/checkout`, successUrl, cancelUrl });

      const prop = data[0];
      const blockchainPropertyId = prop.BlockchainPropertyId;
      const checkInTs = Math.floor(moment(startDate, 'MM-DD-YYYY').valueOf() / 1000);
      const checkOutTs = Math.floor(moment(endDate, 'MM-DD-YYYY').valueOf() / 1000);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(`${paymentsServerUrl}/payments/revolut/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: totalWithCleaningFee,
          currency,
          description: `Booking for ${title}`,
          successUrl,
          cancelUrl,
          metadata: {
            userId: user?.id,
            propertyId: blockchainPropertyId, // Blockchain property ID for on-chain booking
            cmsPropertyId: propIdForCheckout, // CMS document ID
            checkInDate: checkInTs,
            checkOutDate: checkOutTs,
            startDate,
            endDate,
            guest,
            room,
            slug,
            pricePerNight: price,
            atlasFee: atlasfees,
            cleaningFee: cleaningfee,
            propertyTitle: title,
          },
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error('Failed to create Revolut checkout', err);
        alert('Failed to start payment.');
        return;
      }

      const payload = await res.json().catch(() => null);
      console.debug('[payments] checkout response', payload);
      const redirectUrl = payload?.redirectUrl || payload?.url;
      if (!redirectUrl) {
        alert('Payment could not be started.');
        return;
      }
      window.location.assign(redirectUrl);
    } catch (e) {
      console.error('Revolut checkout error', e);
      const aborted = e?.name === 'AbortError';
      alert(aborted ? 'Payment server did not respond in time. Please try again.' : 'Failed to start Revolut payment.');
    }
  };

  return (
    <PageWrapper>
      <h2>Confirm and Pay</h2>
      <Section>
        <h3>Your trip</h3>
        <SummaryBox>
          <p>
            <strong>Location:</strong>{' '}
            <a target="_blank" href={`/post/${slug}`} rel="noopener noreferrer">
              <img
                height="100px"
                width="100px"
                src={resolveURL(homeImage) || '/images/single-post-bg.jpg'}
                alt={title}
              />
              {title}
            </a>
          </p>
          <p>This reservation is non-refundable.</p>
          <p>
            <strong>Dates:</strong> {moment(startDate, 'MM-DD-YYYY').format('MMM D, YYYY')} –{' '}
            {moment(endDate, 'MM-DD-YYYY').format('MMM D, YYYY')}
          </p>
          <p>
            <strong>Guests:</strong> {guest}
          </p>
          <p>
            <strong>Rooms:</strong> {room}
          </p>
          <p>
            <strong>Price:</strong> {formatPrice(price, currency)} × {nights} nights = {formatPrice(total, currency)}
          </p>
          <p>
            <strong>Atlas Fees:</strong> {formatPrice(feesTotal, currency)}
          </p>
          <p>
            <strong>Cleaning Fee:</strong> {formatPrice(cleaningfee, currency)}
          </p>
          <p>
            <strong>Total:</strong> {formatPrice(totalWithCleaningFee, currency)}
          </p>
        </SummaryBox>
      </Section>

      <Divider />

      <Section style={{ textAlign: 'center' }}>
        <Button
          type="primary"
          size="large"
          onClick={startEURCPayment}
          style={{ marginRight: 12, background: '#0052FF' }}
        >
          Pay with EURC
        </Button>
        <Button
          type="primary"
          size="large"
          onClick={startRevolutHostedCheckout}
        >
          Pay with Credit Card
        </Button>
      </Section>

      {/* EURC Payment Modal */}
      <Modal
        open={eurcModalOpen}
        onCancel={closeEurcModal}
        footer={null}
        title="Pay with EURC (Euro Stablecoin)"
        centered
        width={420}
      >
        {eurcLoading ? (
          <CryptoPaymentBox>
            <Spin indicator={<LoadingOutlined style={{ fontSize: 48 }} spin />} />
            <p>Setting up payment...</p>
          </CryptoPaymentBox>
        ) : eurcPayment ? (
          <CryptoPaymentBox>
            {/* Status Badge */}
            <StatusBadge status={eurcStatus || 'pending'}>
              {eurcStatus === 'pending' && (
                <>
                  <LoadingOutlined spin />
                  Waiting for EURC...
                </>
              )}
              {eurcStatus === 'confirming' && (
                <>
                  <LoadingOutlined spin />
                  Creating booking...
                </>
              )}
              {eurcStatus === 'completed' && (
                <>
                  <CheckCircleOutlined />
                  Booking confirmed!
                </>
              )}
              {eurcStatus === 'expired' && 'Payment expired'}
              {eurcStatus === 'error' && 'Error occurred'}
            </StatusBadge>

            {/* QR Code */}
            <QRCodeContainer>
              <img
                alt="EURC Payment QR Code"
                width={200}
                height={200}
                style={{ borderRadius: 8 }}
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(eurcPayment.qrData || eurcPayment.paymentAddress)}`}
              />
            </QRCodeContainer>

            {/* Amount */}
            <AmountBox style={{ background: 'linear-gradient(135deg, #0052FF 0%, #0039B3 100%)' }}>
              <div style={{ fontSize: 14, opacity: 0.9 }}>Send exactly</div>
              <div style={{ fontSize: 28, fontWeight: 700 }}>
                {eurcPayment.expectedAmountEURC} EURC
              </div>
              <div style={{ fontSize: 12, opacity: 0.8 }}>
                ≈ €{eurcPayment.expectedAmountEURC} (1:1 with EUR) on Base Sepolia
              </div>
            </AmountBox>

            {/* Address */}
            <div>
              <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>
                Send to your Atlas wallet:
              </div>
              <AddressBox>
                {eurcPayment.paymentAddress}
              </AddressBox>
              <Button
                type="link"
                icon={<CopyOutlined />}
                onClick={() => copyToClipboard(eurcPayment.paymentAddress)}
                style={{ marginTop: 4 }}
              >
                Copy Address
              </Button>
            </div>

            {/* Expiry */}
            <div style={{ fontSize: 12, color: '#999' }}>
              Payment session expires at {new Date(eurcPayment.expiresAt).toLocaleTimeString()}
            </div>

            {eurcStatus === 'completed' && (
              <div style={{ color: '#52c41a', fontSize: 14, fontWeight: 500 }}>
                <CheckCircleOutlined style={{ marginRight: 8 }} />
                Booking confirmed! Redirecting...
              </div>
            )}
          </CryptoPaymentBox>
        ) : (
          <CryptoPaymentBox>
            <p>Something went wrong. Please try again.</p>
            <Button onClick={closeEurcModal}>Close</Button>
          </CryptoPaymentBox>
        )}
      </Modal>
    </PageWrapper>
  );
};

export default PaymentPage;
