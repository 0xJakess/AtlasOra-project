import React from 'react';
import PropTypes from 'prop-types';
import * as FaIcons from 'react-icons/fa';
import Heading from 'components/UI/Heading/Heading';
import IconCard from 'components/IconCard/IconCard';
import AmenitiesWrapper, { AmenitiesArea } from './Amenities.style';
import { Element } from 'react-scroll';

const Amenities = ({
  amenities = [],
  titleStyle = {
    color: '#2C2C2C',
    fontSize: ['17px', '20px', '25px'],
    lineHeight: ['1.15', '1.2', '1.36'],
    mb: ['14px', '20px', '30px'],
  },
  linkStyle = {
    fontSize: '15px',
    fontWeight: '700',
    color: '#008489',
  },
}) => {
  return (
    <Element name="amenities" className="Amenities">
      <AmenitiesWrapper>
        <Heading as="h2" content="Amenities" {...titleStyle} />
        <AmenitiesArea>
          {amenities.map((amenity) => {
            const IconComponent = FaIcons[amenity.Icon]; // icon name from Strapi like "FaWifi"
            return (
              <IconCard
                key={amenity.id}
                icon={IconComponent ? <IconComponent /> : null}
                title={amenity.Name}
              />
            );
          })}
        </AmenitiesArea>
      </AmenitiesWrapper>
    </Element>
  );
};

Amenities.propTypes = {
  amenities: PropTypes.array,
  titleStyle: PropTypes.object,
  linkStyle: PropTypes.object,
};

export default Amenities;
