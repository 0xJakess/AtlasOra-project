import React, { Fragment, useState } from 'react';
import PropTypes from 'prop-types';
import { IoIosStar, IoIosStarOutline, IoIosArrowDown } from 'react-icons/io';
import { Row, Col, Button, Input, Checkbox, Divider, Modal } from 'antd';
import CommentCard from 'components/UI/CommentCard/CommentCard';
import Heading from 'components/UI/Heading/Heading';
import Text from 'components/UI/Text/Text';
import ReviewForm from './ReviewForm';
import ReviewWrapper, { HeaderSection, RatingStatus } from './Review.style';
import { Element } from 'react-scroll';

const Search = Input.Search;
const CommentBox = (props) => {
  const { reviews } = props;
  return reviews && reviews.length !== 0
    ? reviews.map((singleReview, i) => {
      return (
        <Fragment key={i}>
          <Divider />
          <CommentCard singleReview={singleReview} />
        </Fragment>
      );
    })
    : 'No Review Found';
};

const Review = (props) => {
  const {
    statusHeadingStyle = {
      color: '#2C2C2C',
      fontSize: ['17px', '20px', '25px'],
      mr: '10px',
    },
    filterHeadingStyle = {
      color: '#2C2C2C',
      fontSize: '15px',
      fontWeight: '700',
      lineHeight: '1.2',
      mb: '0.5em',
    },
    ratingLabelStyle = {
      fontSize: '13px',
      fontWeight: '400',
      color: '#2c2c2c',
      flex: '1',
    },
    ratingCountStyle = {
      fontSize: '13px',
      fontWeight: '400',
      color: '#2c2c2c',
      ml: '8px',
    },
    ratingCount,
    reviews,
  } = props;

  const [state, setState] = useState({
    review: false,
    language: false,
  });
  const handleModalOpen = (key) => {
    setState({ ...state, [key]: true });
  };
  const handleModalClose = (key) => {
    setState({ ...state, [key]: false });
  };
  const onChange = (e) => {
    console.log(`checked = ${e.target.checked}`);
  };

  return (
    <Element name="reviews" className="reviews">
      <ReviewWrapper>
        <HeaderSection>
          <RatingStatus>
            <Heading
              content={`${ratingCount} Review(s)`}
              {...statusHeadingStyle}
            />
            {/*
            
            replace this with the actual stars
            <IoIosStar />
            <IoIosStar />
            <IoIosStar />
            <IoIosStar />
            <IoIosStar />
            */}
          </RatingStatus>
        </HeaderSection>

        <CommentBox reviews={reviews} />
      </ReviewWrapper>
    </Element>
  );
};

Review.propTypes = {
  statusHeadingStyle: PropTypes.object,
  filterHeadingStyle: PropTypes.object,
  ratingLabelStyle: PropTypes.object,
  ratingCountStyle: PropTypes.object,
};

export default Review;
