// default data for filter elements
export const priceInit = {
  0: '$0',
  500: '$500',
};

export const calenderItem = {
  separator: '-',
  format: 'MM-DD-YYYY',
  locale: 'en',
};

export const getAmenities = {
  id: 1,
  name: 'Amenities',
  identifier: 'amenities',
  options: [
    { label: 'Free Wi-Fi', value: 'free-wifi' },
    { label: 'Free Parking', value: 'free-parking' },
    { label: 'Breakfast included', value: 'breakfast' },
    { label: 'Pool', value: 'pool' },
    { label: 'Air Conditioning', value: 'air-conditioning' },
    { label: 'Hot Shower', value: 'hot-shower' },
    { label: 'Cable TV', value: 'cable-tv' },
  ],
};

export const getPropertyType = {
  id: 2,
  name: 'Property Type',
  identifier: 'property-type',
  options: [
    { label: 'Villa', value: 'Villa' },
    { label: 'Hotel', value: 'Hotel' },
    { label: 'Resort', value: 'Resort' },
    { label: 'Cottage', value: 'Cottage' },
    { label: 'Duplex', value: 'Duplex' },
    { label: 'Landscape', value: 'Landscape' },
    { label: 'Condo', value: 'Condo' },
  ],
};
