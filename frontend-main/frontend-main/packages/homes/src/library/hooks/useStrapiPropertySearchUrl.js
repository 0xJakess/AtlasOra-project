/* todo
    location filter
    description filter
    formatted address filter
*/

import { useMemo } from 'react';

const slugToName = (slug) =>
  slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

export default function useStrapiPropertySearchUrl(search) {
  const url = useMemo(() => {
    if (!search) return null;

    const queryParams = new URLSearchParams(search);
    const filterParams = [];

    const address = queryParams.get('address');
    //todo: add the date range later when the booking engine is in place
    const dateRange = queryParams.get('date_range');
    const room = queryParams.get('room');
    const guest = queryParams.get('guest');
    const price = queryParams.get('price');
    const amenities = queryParams.get('amenities');
    const property = queryParams.get('property');

    //check title and address or just title if too little for address
    if (address && address.length >= 4) {
      filterParams.push(`filters[$or][0][Title][$containsi]=${address}`);
      filterParams.push(`filters[$or][1][FormattedAddress][$eq]=${address}`);
      filterParams.push(`filters[$or][2][Address1][$eq]=${address}`);
      filterParams.push(`filters[$or][3][Address2][$eq]=${address}`);
      filterParams.push(`filters[$or][4][Address3][$eq]=${address}`);
      filterParams.push(`filters[$or][5][Address4][$eq]=${address}`);
      filterParams.push(`filters[$or][6][Address5][$eq]=${address}`);
    } else if (address && address.length > 0) {
      filterParams.push(`filters[$or][0][Title][$containsi]=${address}`);
    }
    //room and guest filter
    if (room) filterParams.push(`filters[Rooms][$gte]=${room}`);
    if (guest) filterParams.push(`filters[MaxGuests][$gte]=${guest}`);

    if (price) {
      const [min, max] = price.split(',');
      if (min) filterParams.push(`filters[PricePerNight][$gte]=${min}`);
      if (max) filterParams.push(`filters[PricePerNight][$lte]=${max}`);
    }

    if (property) {
      const types = property.split(',');
      types.forEach((type, i) => {
        filterParams.push(
          `filters[property_type][Name][$in][${i}]=${encodeURIComponent(type)}`,
        );
      });
    }

    if (amenities) {
      const items = amenities.split(',');
      items.forEach((slug, i) => {
        filterParams.push(
          `filters[property_amenities][Name][$in][${i}]=${slugToName(slug)}`,
        );
      });
    }

    filterParams.push(`filters[CurrentlyRented][$eq]=false`);
    //todo : maybe it is smart to pass these in one level up, but it works for now
    const populate = [
      'populate[currency]=true',
      'populate[Images]=true',
      'populate[property_amenities]=true',
      'populate[property_type]=true',
    ];

    const baseUrl = import.meta.env.VITE_APP_API_URL;
    return `${baseUrl}properties?` + [...filterParams, ...populate].join('&');
  }, [search]);

  return url;
}
