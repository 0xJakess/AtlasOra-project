import React, { useState } from 'react';
import { IoIosClose } from 'react-icons/io';
import Rating from 'components/UI/Rating/Rating';
import { Button, Modal } from 'antd';
import StickyBooking from 'components/StickyBooking/StickyBooking';
import Reservation from './Reservation';

const BottomReservation = ({ title, price, currency, rating, ratingCount, propertyId, slug }) => {
  const [visible, setVisible] = useState(false);

  return (
    <>
      <StickyBooking
        logo="/images/logo-alt.svg"
        title={title}
        price={price}
        currency={currency}
        rating={
          <Rating rating={rating} ratingCount={ratingCount} type="bulk" />
        }
        action={
          <Button type="primary" onClick={() => setVisible(true)}>
            Book
          </Button>
        }
      />

      <Modal
        open={visible}
        onCancel={() => setVisible(false)}
        footer={null}
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
        }}
        wrapClassName="reservation_modal"
        closable={false}
      >
        <Reservation propertyId={propertyId} slug={slug} price={price} currency={currency} />
        <Button onClick={() => setVisible(false)} className="close">
          <IoIosClose />
        </Button>
      </Modal>
    </>
  );
};

export default BottomReservation;
