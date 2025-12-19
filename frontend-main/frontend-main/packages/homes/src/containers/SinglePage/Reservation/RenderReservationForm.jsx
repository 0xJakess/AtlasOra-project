import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from 'antd';
import moment from 'moment';
import { ethers } from 'ethers';
import { Modal } from 'antd';
import { useContracts } from 'context/ContractProvider';
import HtmlLabel from 'components/UI/HtmlLabel/HtmlLabel';
import DatePickerRange from 'components/UI/DatePicker/ReactDates';
import ViewWithPopup from 'components/UI/ViewWithPopup/ViewWithPopup';
import InputIncDec from 'components/UI/InputIncDec/InputIncDec';

import ReservationFormWrapper, {
  FormActionArea,
  FieldWrapper,
  RoomGuestWrapper,
  ItemWrapper,
  Notice,
} from './Reservation.style';

const PARAMS_KEY = 'listing_search_params';

// ✅ Accept props
const RenderReservationForm = ({ propertyId, slug, pricePerNightEth }) => {
  const navigate = useNavigate();
  const backendBaseUrl = import.meta.env.VITE_BACKEND_BASE_URL || 'http://localhost:3000';
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showPayment, setShowPayment] = useState(false);
  const [paymentData, setPaymentData] = useState(null);
  const { createBooking, contractAddresses, publicClient } = useContracts();
  const { getProperty, hasBookingConflict, getBookingManagerMarketplaceAddress, getPropertyFromMarketplace } = useContracts();

  const [formState, setFormState] = useState({
    startDate: null,
    endDate: null,
    room: 0,
    guest: 0,
  });

  useEffect(() => {
    const stored = localStorage.getItem(PARAMS_KEY);
    if (stored) {
      const params = new URLSearchParams(stored.replace(/^\?/, ''));

      const startDateRaw = params.get('startDate');
      const endDateRaw = params.get('endDate');
      const room = parseInt(params.get('room'), 10) || 0;
      const guest = parseInt(params.get('guest'), 10) || 0;

      const parseDate = (val) => {
        if (!val) return null;
        // Try strict known formats then fallback to moment auto-parse
        const tryFormats = ['MM-DD-YYYY', 'llll', 'YYYY-MM-DD'];
        for (const fmt of tryFormats) {
          const m = moment(val, fmt, true);
          if (m.isValid()) return m;
        }
        const mAuto = moment(val);
        return mAuto.isValid() ? mAuto : null;
      };

      const startDate = parseDate(startDateRaw);
      const endDate = parseDate(endDateRaw);

      setFormState({
        startDate,
        endDate,
        room,
        guest,
      });
    }
  }, []);

  const handleIncrement = (type) => {
    setFormState((prev) => ({
      ...prev,
      [type]: parseInt(prev[type]) + 1,
    }));
  };

  const handleDecrement = (type) => {
    setFormState((prev) => ({
      ...prev,
      [type]: Math.max(0, parseInt(prev[type]) - 1),
    }));
  };

  const handleIncDecOnChange = (e, type) => {
    let currentValue = parseInt(e.target.value, 10);
    if (!isNaN(currentValue)) {
      setFormState((prev) => ({
        ...prev,
        [type]: currentValue,
      }));
    }
  };

  const updateSearchDataFunc = (value) => {
    const parseStrict = (val) => {
      if (!val) return null;
      const m1 = moment(val, 'MM-DD-YYYY', true);
      if (m1.isValid()) return m1;
      const m2 = moment(val, 'llll', true);
      if (m2.isValid()) return m2;
      const m3 = moment(val);
      return m3.isValid() ? m3 : null;
    };
    const nextStart = value.startMoment || parseStrict(value.setStartDate);
    const nextEnd = value.endMoment || parseStrict(value.setEndDate);
    setFormState((prev) => ({
      ...prev,
      startDate: nextStart,
      endDate: nextEnd,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const { startDate, endDate, room, guest } = formState;

    if (!startDate || !endDate) {
      alert('Please select start and end dates.');
      return;
    }

    // ✅ Add id and slug to query
    const queryParams = new URLSearchParams({
      startDate: startDate.format('MM-DD-YYYY'),
      endDate: endDate.format('MM-DD-YYYY'),
      room: room.toString(),
      guest: guest.toString(),
      propertyId: propertyId?.toString() || '',
      slug: slug || '',
    });

    navigate(`/payment?${queryParams.toString()}`);
  };

  const handleOnChainBooking = async () => {
    try {
      setError('');
      setIsSubmitting(true);
      if (!propertyId) throw new Error('Missing propertyId');
      const { startDate, endDate } = formState;
      if (!startDate || !endDate) throw new Error('Select dates first');
      const checkInTs = startDate.clone().utc().startOf('day').unix();
      const checkOutTs = endDate.clone().utc().startOf('day').unix();
      const nowTs = Math.floor(Date.now() / 1000);
      if (checkInTs <= nowTs) throw new Error('Check-in must be in the future (pick tomorrow or later)');
      if (checkOutTs <= checkInTs) throw new Error('Check-out must be after check-in');
      const secondsPerNight = 24 * 60 * 60;
      const numNights = Math.ceil((checkOutTs - checkInTs) / secondsPerNight);
      if (numNights <= 0) throw new Error('Booking must be at least 1 night');
      // Preflight: read property from chain to ensure active and correct price
      const onChainProp = await getProperty(propertyId);
      // onChainProp tuple: [propertyId, tokenAddress, owner, pricePerNight, isActive, propertyURI]
      const onChainPricePerNightWei = onChainProp?.[3] || 0n;
      const isActive = onChainProp?.[4];
      console.debug('[booking] preflight property', { propertyId, onChainProp });
      if (!isActive) throw new Error('Property is not active');

      // Double-check BookingManager -> marketplace link and property exists there
      try {
        const marketplaceAddr = await getBookingManagerMarketplaceAddress();
        const mpProp = await getPropertyFromMarketplace(marketplaceAddr, propertyId);
        console.debug('[booking] marketplace check', { marketplaceAddr, mpProp });
      } catch (mpErr) {
        console.warn('[booking] marketplace consistency check failed', mpErr);
      }
      // Check conflicts
      const conflict = await hasBookingConflict(propertyId, checkInTs, checkOutTs);
      console.debug('[booking] conflict check', { conflict, checkInTs, checkOutTs });
      if (conflict) throw new Error('Selected dates conflict with an existing booking');

      const totalAmountWei = onChainPricePerNightWei * BigInt(numNights);
      const bookingManagerAddress = contractAddresses?.victionTestnet?.bookingManager || '';
      const qrData = bookingManagerAddress ? `ethereum:${bookingManagerAddress}@89?value=${totalAmountWei.toString()}` : '';
      console.debug('[booking] prepared payment', { totalAmountWei: totalAmountWei.toString(), bookingManagerAddress, numNights });
      setPaymentData({
        address: bookingManagerAddress,
        totalAmountWei: totalAmountWei.toString(),
        checkInTs,
        checkOutTs,
        qrData,
      });
      setShowPayment(true);
    } catch (e) {
      console.error('[booking] preflight error', e);
      setError(e.message || 'Booking failed');
      Modal.error({ title: 'Booking Error', content: e.message || 'Booking failed' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ReservationFormWrapper className="form-container" onSubmit={handleSubmit}>
      <FieldWrapper>
        <HtmlLabel htmlFor="dates" content="Dates" />
        <DatePickerRange
          startDateId="checkin-Id"
          endDateId="checkout-id"
          startDatePlaceholderText="Check In"
          endDatePlaceholderText="Check Out"
          item={{ format: 'MM-DD-YYYY' }}
          numberOfMonths={1}
          small
          updateSearchData={updateSearchDataFunc}
          startDate={formState.startDate}
          endDate={formState.endDate}
        />
      </FieldWrapper>

      <FieldWrapper>
        <HtmlLabel htmlFor="guests" content="Guests" />
        <ViewWithPopup
          key={200}
          noView={true}
          className={formState.room || formState.guest ? 'activated' : ''}
          view={
            <Button type="default">
              <span>Room {formState.room > 0 && `: ${formState.room}`}</span>
              <span> - </span>
              <span>Guest{formState.guest > 0 && `: ${formState.guest}`}</span>
            </Button>
          }
          popup={
            <RoomGuestWrapper>
              <ItemWrapper>
                <strong>Room</strong>
                <InputIncDec
                  id="room"
                  increment={() => handleIncrement('room')}
                  decrement={() => handleDecrement('room')}
                  onChange={(e) => handleIncDecOnChange(e, 'room')}
                  value={formState.room}
                />
              </ItemWrapper>

              <ItemWrapper>
                <strong>Guest</strong>
                <InputIncDec
                  id="guest"
                  increment={() => handleIncrement('guest')}
                  decrement={() => handleDecrement('guest')}
                  onChange={(e) => handleIncDecOnChange(e, 'guest')}
                  value={formState.guest}
                />
              </ItemWrapper>
            </RoomGuestWrapper>
          }
        />
      </FieldWrapper>

      <FormActionArea>
        <Button htmlType="submit" type="primary" block>
          Book Now
        </Button>
        {error && <div style={{ color: '#dc3545', marginTop: 8 }}>{error}</div>}
      </FormActionArea>

      <Modal open={showPayment} onCancel={() => setShowPayment(false)} footer={null} title="Choose a payment method" centered>
        {paymentData && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 16 }}>
            {paymentData.qrData && (
              <div>
                <div style={{ marginBottom: 8, fontWeight: 600 }}>Scan to Pay (QR)</div>
                <img
                  alt="QR"
                  width={200}
                  height={200}
                  style={{ borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(paymentData.qrData)}`}
                />
              </div>
            )}
            <div style={{ background: '#f7fafc', padding: '12px 16px', borderRadius: 8, width: '100%', maxWidth: 420 }}>
              <div style={{ fontSize: 14, color: '#667085' }}>Total</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{String(Number(paymentData.totalAmountWei) / 1e18)} ETH</div>
            </div>
            <div style={{ background: '#fafafa', padding: '10px 12px', borderRadius: 8, fontFamily: 'monospace', wordBreak: 'break-all', width: '100%', maxWidth: 420 }}>
              {paymentData.address}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <Button onClick={() => navigator.clipboard.writeText(paymentData.address)}>Copy Address</Button>
              <Button
                type="primary"
                onClick={async () => {
                  try {
                    setIsSubmitting(true);
                    // Pay with MetaMask via direct contract call (same as BackendIntegration)
                    console.debug('[booking] sending tx', {
                      propertyId,
                      checkInTs: paymentData.checkInTs,
                      checkOutTs: paymentData.checkOutTs,
                      totalAmountWei: paymentData.totalAmountWei,
                    });
                    const txHash = await createBooking(
                      propertyId,
                      paymentData.checkInTs,
                      paymentData.checkOutTs,
                      BigInt(paymentData.totalAmountWei)
                    );
                    console.debug('[booking] tx sent', txHash);
                    // Wait for receipt
                    try {
                      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
                      console.debug('[booking] receipt', receipt);
                      setShowPayment(false);
                      const explorer = 'https://testnet.vicscan.xyz/tx/' + txHash;
                      Modal.success({ title: 'Booking Confirmed', content: `Success. Tx: ${txHash}\n${explorer}` });
                    } catch (waitErr) {
                      console.error('[booking] wait receipt error', waitErr);
                      Modal.info({ title: 'Transaction Submitted', content: `Tx submitted. Awaiting confirmation. Hash: ${txHash}` });
                    }
                  } catch (err) {
                    console.error('[booking] tx error', err);
                    const msg = err?.shortMessage || err?.message || 'Failed to create booking';
                    setError(msg);
                    Modal.error({ title: 'Transaction Error', content: msg.includes('chain') ? `${msg}. Ensure your wallet is on Viction Testnet (chain 89).` : msg });
                  } finally {
                    setIsSubmitting(false);
                  }
                }}
              >
                Pay with MetaMask
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </ReservationFormWrapper>
  );
};

export default RenderReservationForm;
