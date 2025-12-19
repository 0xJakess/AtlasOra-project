import React from 'react';
import PropTypes from 'prop-types';
import Heading from 'components/UI/Heading/Heading';
import Text from 'components/UI/Text/Text';
import LocationWrapper from './Location.style';
import { Element } from 'react-scroll';

const Location = ({
  locationBlocks = [],
  titleStyle = {
    color: '#2C2C2C',
    fontSize: ['17px', '20px', '25px'],
    lineHeight: ['1.15', '1.2', '1.36'],
    mb: '4px',
  },
  contentStyle = {
    fontSize: '15px',
    fontWeight: '400',
    color: '#2C2C2C',
    lineHeight: '1.6',
    mb: ['14px', '20px', '27px'],
  },
}) => {
  return (
    <Element name="location" className="location">
      <LocationWrapper>
        <Heading as="h2" content="Location" {...titleStyle} />
        {Array.isArray(locationBlocks) &&
          locationBlocks.map((block, index) => {
            const text =
              block.children
                ?.map((child) => child.text)
                .join('')
                .trim() || '';
            return text ? (
              <Text key={index} content={text} {...contentStyle} />
            ) : null;
          })}
      </LocationWrapper>
    </Element>
  );
};

Location.propTypes = {
  locationBlocks: PropTypes.array,
  titleStyle: PropTypes.object,
  contentStyle: PropTypes.object,
};

export default Location;
